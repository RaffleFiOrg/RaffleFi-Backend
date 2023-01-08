import { createPool } from 'mariadb';
import fs from 'fs';
import { BigNumber, ethers } from 'ethers';
import * as dotenv from 'dotenv';
dotenv.config();

const db_config = {
    host: process.env.DB_ADDRESS,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 3,
    connectionTimeout: 600000
}

async function main() {
    const pool = createPool(db_config);

    const abiParsed = JSON.parse(fs.readFileSync('./src/abi/RaffleTicketsSystem.json').toString());
    const abi = abiParsed.abi;
    const ERC20Parsed = JSON.parse(fs.readFileSync('./src/abi/ERC20.json').toString());

    const l2Chain = String(process.env.L2_NETWORK)
    const l2NetworkKey = l2Chain === 'arbitrum' ? 'arbitrum-goerli' : 'maticmum'
    const l2Network = ethers.providers.getNetwork(l2NetworkKey)
    const providerKey = l2Chain === 'arbitrum' ? process.env.ARBITRUM_KEY : process.env.MUMBAI_KEY
    const l2Provider = new ethers.providers.AlchemyProvider(l2Network, providerKey);
    const contractAddress = process.env.TICKETS_CONTRACT;

    // Create the l2 contract
    const contract = new ethers.Contract(
        String(contractAddress),
        abi,
        l2Provider
    )

    const ticketSellOrderCreatedFilter = contract.filters.TicketSellOrderCreated();
    const ticketSellOrderCancelledFilter = contract.filters.TicketSellOrderCancelled();
    const ticketBoughtFromMarketFilter = contract.filters.TicketBoughtFromMarket();
    const ticketBoughtFromMarketWithSignatureFilter = contract.filters.TicketBoughtFromMarketWithSignature();
    
    async function getName(contractAddress: string): Promise<string> {
        try {
            const contract = new ethers.Contract(contractAddress, ERC20Parsed, l2Provider);
            const name: string = await contract.name();
            return name;
        } catch (e) {
            return ''
        }
    }

    async function getDecimals(contractAddress: string): Promise<number> {
        try {
            const contract = new ethers.Contract(contractAddress, ERC20Parsed, l2Provider);
            const decimals: number = await contract.decimals();
            return decimals;
        } catch (e) {
            // by default return 18
            return 18;
        }
    }

    contract.on(ticketSellOrderCreatedFilter, async (
        seller: string,
        raffleId: BigNumber,
        ticketId: BigNumber,
        currency: string,
        price: BigNumber
    ) => {
        let db: any;
        try {
            db = await pool.getConnection();

            // before inserting we need to check whether there was already a ticket order 
            // and replace the data

            // more easily we can directly delete the order 
            await db.query(`DELETE IGNORE FROM orders WHERE 
            raffleId=? AND seller=? AND
            ticketId=?;`, [raffleId.toBigInt(), seller, ticketId.toString()])

            const name = await getName(currency);
            const decimals = await getDecimals(currency);
            await db.query(`INSERT INTO orders 
                (
                    currency, price, raffleId, 
                    ticketId, bought, boughtBy, 
                    seller, currencyName,
                    currencyDecimals
                ) 
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?);`,
                [
                    currency,
                    price.toString(),
                    raffleId.toString(),
                    ticketId.toString(),
                    "false",
                    "0",
                    seller,
                    name,
                    decimals.toString()
                ]
            );
        } catch (e) {
            console.log(e)
        } finally {
            if (db) await db.release();
        }
    });

    contract.on(ticketSellOrderCancelledFilter, async (
        seller: string,
        raffleId: BigNumber,
        ticketId: BigNumber,
        currency: string,
        price: BigNumber
    ) => {
        let db: any;
        try {
            db = await pool.getConnection();
            await db.query(
                `DELETE FROM orders 
                WHERE ticketId=? AND raffleId=?;`,
                [ticketId.toString(), raffleId.toString()]
            );
        } catch (e) {
            console.log(e); 
        } finally {
            if (db) await db.release()
        }
    });

    contract.on(ticketBoughtFromMarketFilter, async (
        buyer: string,
        seller: string,
        raffleId: BigNumber,
        ticketId: BigNumber,
        currency: string,
        price: BigNumber
    ) => {
        let db;
        console.log( buyer,
            seller,
            raffleId,
            ticketId,
            currency,
            price)
        try {
            db = await pool.getConnection();
            await db.query(
                `UPDATE orders SET bought='true', 
                boughtBy=? WHERE 
                raffleId=? AND ticketId=?;`,
                [buyer, raffleId.toString(), ticketId.toString()]
            );
        } catch (e) {
            console.log(e); 
        } finally {
            if (db) await db.release()
        } 
    });

    contract.on(ticketBoughtFromMarketWithSignatureFilter, async (
        buyer: string,
        seller: string,
        raffleId: BigNumber,
        ticketId: BigNumber,
        currency: string,
        price: BigNumber
    ) => {
        let db;
        try {
            db = await pool.getConnection();
            await db.query(
                `UPDATE orders SET bought='true', 
                boughtBy=? WHERE 
                raffleId=? AND ticketId=?;`,
                [buyer, raffleId.toString(), ticketId.toString()]); 
        } catch (error) {
            console.log(error);
        } finally {
            if (db) await db.release();
        }
    });
}

main().catch();