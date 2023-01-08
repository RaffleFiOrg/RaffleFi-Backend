jest.setTimeout(900000)
import { expect } from "chai";
import { ethers, Contract, Wallet } from "ethers";
import dotenv from 'dotenv'
import { createPool, Pool, PoolConnection } from "mariadb";
import fs from 'fs'

dotenv.config()

let mainnetContract: Contract 
const mainnetContractAddress: string = String(process.env.CONTRACT_ETH)
const privateKey: string = String(process.env.PRIVATE_KEY)

const contractAbi = JSON.parse(
    fs.readFileSync(
        './abi/RafflePolygon.json'
    ).toString()
).abi 


let provider
let wallet: Wallet

const mainnetNetwork = ethers.providers.getNetwork('arbitrum-goerli')

let pool: Pool

const createMockRaffle = async (db: PoolConnection) => {
    await db.query(`INSERT INTO raffles (raffleId) VALUES (100000);`)
}

const deleteMockRaffle = async (db: PoolConnection) => {
    await db.query(`DELETE FROM raffles WHERE raffleId=100000;`)
}

const createExpiringRaffle = async (db: PoolConnection) => {
    await db.query(`INSERT INTO raffles (raffleId, endTimestamp, raffleState) VALUES (100000, 21414344, 'IN_PROGRESS');`)
}

describe('Complete raffles', () => {
    const db_config = {
        host: process.env.DB_ADDRESS,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        connectionLimit: 1  
    }
    
    pool = createPool(db_config);


    beforeAll(async () => {
        provider = new ethers.providers.JsonRpcProvider(
            String(process.env.MAINNET_RPC),
            mainnetNetwork
        )
        
        wallet = new ethers.Wallet(privateKey, provider)
        
        mainnetContract = new Contract(
            mainnetContractAddress,
            contractAbi,
            wallet 
        )
    })

    it('Fetches raffles form the db', async () => {
        const db = await pool.getConnection()
        await deleteMockRaffle(db)
        await createMockRaffle(db)
        const rows = await db.query(`SELECT raffleId FROM raffles WHERE raffleId=100000;`)
        await deleteMockRaffle(db)
        await db.release()
        expect(rows.length).to.be.gt(0)
    })

    it('Fetches results from the DB for raffles over the deadline', async () => {
        const dateNow = new Date()
        const timeNow = Math.floor(dateNow.getTime() / 1000)

        const db = await pool.getConnection()
        await createExpiringRaffle(db)
        const rows = await db.query( `SELECT raffleId FROM raffles WHERE raffleState='IN_PROGRESS' 
        AND endTimestamp < ?;`,
        [
            timeNow
        ])
        await deleteMockRaffle(db)
        await db.release()
        expect(rows.length).to.be.gt(0)
    })
})