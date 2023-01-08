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
    connectionLimit: 4
}

async function main() {
    const pool = createPool(db_config);
    const lotteryAbi = JSON.parse(fs.readFileSync('./abi/MonthlyLottery.json').toString());
    const abi = lotteryAbi.abi;
    const network = ethers.providers.getNetwork('goerli');
    const provider = new ethers.providers.AlchemyProvider(network, process.env.MAINNET_KEY);
    
    const contractAddress = process.env.CONTRACT_ADDRESS;

    const contract = new ethers.Contract(
        String(contractAddress),
        abi,
        provider
    );

   const ticketAssignedFilter = contract.filters.TicketAssigned();
   contract.on(ticketAssignedFilter, async function(
    lotteryId: BigNumber, initTicketId: BigNumber, endTicketId: BigNumber, user: string
    ) {
        let db: any;
        try {
            db = await pool.getConnection();
            await db.query(`INSERT INTO monthly_lottery_tickets_erc721 (
                lotteryId, init_ticket, end_ticket, account) VALUES(?, ?, ?, ?);`, [
                    lotteryId.toString(), initTicketId.toString(), endTicketId.toString(),
                    user
                ]);
            // update the total lottery tickets sold 
            await db.query(`
                UPDATE monthly_lottery_erc721 
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

   const lotteryStartedFilter = contract.filters.NewLotteryStarted();
   contract.on(lotteryStartedFilter, async function(lotteryId: BigNumber) {
        let db: any;
        try {
            db = await pool.getConnection();
            await db.query(`INSERT INTO monthly_lottery_erc721(lotteryId, status) VALUES(
                ?, ?
            );`, [lotteryId.toString(), 'IN_PROGRESS']);
        } catch(e) {
            console.log(e);
        } finally {
            if (db) await db.release();
        }
   });

   const nftAddedFilter = contract.filters.NFTAdded();
   contract.on(nftAddedFilter, async function(lotteryId: BigNumber, address: string, id: BigNumber) {
        let db: any;
        try {
            db = await pool.getConnection();
            await db.query(`INSERT INTO monthly_lottery_erc721_assets VALUES(?, ?, ?);`,
            [address, id.toString(), lotteryId.toString()]);
        } catch (e) {
            console.log(e)
        } finally {
            if (db) await db.release();
        }
   });

   const lotteryStateChangedFilter = contract.filters.LotteryStateChanged();
   const lotteryStatuses = [' NOT_STARTED','IN_PROGRESS',
   'FINISHED', 'COMPLETED','CLAIMED']
   contract.on(lotteryStateChangedFilter, async function(
        lotteryId: BigNumber,
        oldLotteryState: BigNumber,
        newLotteryState: BigNumber   
   ) {
        let db: any;
        try {
            db = await pool.getConnection();
            await db.query(`UPDATE monthly_lottery_erc721 SET status=? WHERE lotteryId=?`,
            [lotteryStatuses[parseInt(newLotteryState.toString())], lotteryId.toString()]);
        } catch (e) {
            console.log(e)
        } finally {
            if (db) await db.release();
        }
   })


}

main().catch();