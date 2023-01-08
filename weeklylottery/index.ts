import { createPool } from 'mariadb';
import { BigNumber, ethers } from 'ethers';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const db_config = {
    host: process.env.DB_ADDRESS,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 5   
}

async function main() {
    const pool = createPool(db_config);

    const abi = JSON.parse(fs.readFileSync('./abi/WeeklyLottery.json').toString()).abi;
    const ERC20Parsed = JSON.parse(fs.readFileSync('./abi/ERC20.json').toString());

    const l2Chain = String(process.env.L2_CHAIN)
    const networkKey = l2Chain === 'arbitrum' ? 'arbitrum-goerli' : 'maticmum'
    const network = ethers.providers.getNetwork(networkKey);

    const providerKey = l2Chain === 'arbitrum' ? process.env.ARBITRUM_KEY : process.env.MATIC_KEY
    const provider = new ethers.providers.AlchemyProvider(network, providerKey);
    
    const contractAddress = process.env.CONTRACT_ADDRESS;

    const contract = new ethers.Contract(
        String(contractAddress),
        abi,
        provider
    )

    async function getDecimals(contractAddress: string): Promise<number> {
        try {
            const targetContract = new ethers.Contract(contractAddress, ERC20Parsed, provider);
            const decimals = await targetContract.decimals();
            return decimals;
        } catch(e) {
            return 18;
        }
    }

    async function getName(contractAddress: string): Promise<string> {
        try {
            const targetContract = new ethers.Contract(contractAddress, ERC20Parsed, provider);
            const name = await targetContract.name();
            return name;
        } catch(e) {
            return '';
        }
    }

    async function getSymbol(contractAddress: string): Promise<string> {
        try {
            const targetContract = new ethers.Contract(contractAddress, ERC20Parsed, provider);
            const name = await targetContract.symbol();
            return name;
        } catch(e) {
            return '';
        }
    }

    const ticketAssignedFilter = contract.filters.TicketAssigned();
    contract.on(ticketAssignedFilter, async function(
     lotteryId: BigNumber, initTicketId: BigNumber, endTicketId: BigNumber, user: string
     ) {
         let db: any;
         try {
            db = await pool.getConnection();
            await db.query(`INSERT INTO weekly_lottery_tickets 
                (lotteryId, init_ticket, end_ticket, account) VALUES(?, ?, ?, ?);`, [
                    lotteryId.toString(), initTicketId.toString(), endTicketId.toString(),
                    user
                ]);
            // update the total lottery tickets sold 
            await db.query(`
                UPDATE weekly_lottery 
                SET total_tickets_sold=? WHERE
                lotteryId=?;`, [
                    endTicketId.toString(), lotteryId.toString()
                ]
            )
         } catch (e) {
             console.log(e)
         } finally {
             if (db) await db.release();
         }
     });

    const currencyAddedFilter = contract.filters.ERC20CurrencyAdded();
    contract.on(currencyAddedFilter, async function(
        currency: string 
    ) {
        let db: any;
        try {
            db = await pool.getConnection();
            let name: string;
            let decimals: number;
            let symbol: string 
            if (currency === ethers.constants.AddressZero) {
                name = 'Ether';
                decimals = 18
                symbol = 'ETH'
            } else {
                name = await getName(currency);
                decimals = await getDecimals(currency);
                symbol = await getSymbol(currency)
            }
            await db.query(`INSERT INTO weekly_lottery_currencies VALUES(?, ?, ?, ?);`,
            [currency, decimals, name, symbol]
            )
        } catch (e) {
            console.log(e)
        } finally {
            if (db) await db.release();
        }
    });

    const currencyRemovedFilter = contract.filters.ERC20CurrencyRemoved();
    contract.on(currencyRemovedFilter, async function (currency: string) {
        let db: any;
        try {
            db = await pool.getConnection();
            await db.query(`DELETE FROM weekly_lottery_currencies WHERE address=?;`, 
                [currency]
                );
        } catch(e) {
            console.log(e)
        } finally {
            if (db) await db.release();
        }
    })

    const lotteryStateChangedFilter = contract.filters.LotteryStateChanged();
    const lotteryStatuses = [' NOT_STARTED','IN_PROGRESS',
        'FINISHED', 'COMPLETED','CLAIMED']
    contract.on(lotteryStateChangedFilter, async function (
        lotteryId: BigNumber,
        oldLotteryState: number,
        newLotteryState: number 
        ) {
        let db: any;
        try {
            db = await pool.getConnection();
            await db.query(`UPDATE weekly_lottery SET status=? WHERE lotteryId=?;`, 
                [lotteryStatuses[parseInt(newLotteryState.toString())], lotteryId.toString()]
                );
        } catch(e) {
            console.log(e)
        } finally {
            if (db) await db.release();
        }  
    });

    const lotteryStartedFilter = contract.filters.NewLotteryStarted();
    contract.on(lotteryStartedFilter, async function(lotteryId: BigNumber) {
        let db: any;
        try {
            db = await pool.getConnection();
            await db.query(`INSERT INTO weekly_lottery (lotteryId, status, winner) VALUES (?, ?, ?)`,
            [lotteryId.toString(), 'IN_PROGRESS', ethers.constants.AddressZero])
        } catch (e) {
            console.log(e)
        } finally {
            if (db) await db.release();
        }
    });

    const tokenAddedFilter = contract.filters.TokenAdded();
    contract.on(tokenAddedFilter, async function(
        lotteryId: BigNumber, currency: string, amount: BigNumber) {
        let db: any;
        try {
            db = await pool.getConnection();

            // get the current amount of tokens for this
            const res = await db.query(`SELECT amount FROM weekly_lottery_tokens WHERE 
            currency=? AND lotteryId=?`, [currency, lotteryId.toString()]);
            if (res.length === 0) {
                // means we don't have any records
                await db.query(`INSERT INTO weekly_lottery_tokens VALUES(?, ?, ?);`,
                [currency, amount.toString(), lotteryId.toString()]
                );
            } else {
                const newAmount = BigNumber.from(res).add(amount);
                await db.query(`UPDATE weekly_lottery_tokens SET amount=? WHERE lotteryId=? 
                AND currency=?;`, [newAmount.toString(), lotteryId.toString(), currency]);
            }
        } catch (e) {
            console.log(e);
        } finally {
            if (db) await db.release();
        }
    })
}


main().catch();