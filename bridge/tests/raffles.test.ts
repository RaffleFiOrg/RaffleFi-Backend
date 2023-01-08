jest.setTimeout(90000000)
import { expect } from "chai";
import { ethers, Contract, BigNumber, Wallet } from "ethers";
import dotenv from 'dotenv'
import fs from 'fs'
import { createPool, PoolConnection } from "mariadb";
dotenv.config()

function sleep(ms: number) {
    return new Promise(
      resolve => setTimeout(resolve, ms)
    );
}

let mainnetContract: Contract 
let rafflesContract: Contract 
let erc721Contract: Contract 
let erc20Contract: Contract

const mainnetContractAddress: string = String(process.env.CONTRACT_ETH)
const rafflesContractAddress: string = String(process.env.CONTRACT_ARBITRUM)
const tokenToWhitelistArbitrum = "0x098A97265e0a9F227514E39Bc7E0ffCD98bd41a7"
const erc721Address = "0x64Ea1ebc7E8018bA85c7d83847B6738B6a2F4ea4"

const contractAbi = JSON.parse(
    fs.readFileSync(
        './src/abi/MainnetEscrow.json'
    ).toString()
).abi 

const rafflessAbi = JSON.parse(
    fs.readFileSync(
        './src/abi/RafflePolygon.json'
    ).toString()
).abi

const erc20Abi = JSON.parse(
    fs.readFileSync(
        './src/abi/ERC20.json'
    ).toString()
)

const erc721Abi = JSON.parse(
    fs.readFileSync(
        './src/abi/ERC721.json'
    ).toString()
)

let provider: ethers.providers.JsonRpcProvider
let providerArbitrum: ethers.providers.JsonRpcProvider
let wallet: Wallet
let walletArbitrum: Wallet 

const privateKey: string = String(process.env.PRIVATE_KEY)
const mainnetNetwork = ethers.providers.getNetwork('goerli')
const arbitrumNetwork = ethers.providers.getNetwork('arbitrum-goerli')

let db: PoolConnection

interface RaffleData {
    assetContract: String,
    raffleOwner: String,
    raffleWinner: String,
    raffleState: BigNumber,
    raffleType: BigNumber,
    currency: String,
    MerkleRoot: String,
    nftIdOrAmount: BigNumber,
    pricePerTicket: BigNumber,
    endTimestamp: BigNumber,
    numberOfTickets: BigNumber,
    ticketsSold: BigNumber,
    minimumTicketsSold: BigNumber
}

describe('Raffles listener', () => {

    const db_config = {
        host: process.env.DB_ADDRESS,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        connectionLimit: 5   
    }
    
    const pool = createPool(db_config);

    beforeAll(async () => {
        provider = new ethers.providers.JsonRpcProvider(
            String(process.env.MAINNET_RPC),
            mainnetNetwork
        )
        providerArbitrum = new ethers.providers.JsonRpcBatchProvider(
            String(process.env.ARBITRUM_RPC),
            arbitrumNetwork
        )

        wallet = new ethers.Wallet(privateKey, provider)
        walletArbitrum = new ethers.Wallet(privateKey, providerArbitrum)
        
        mainnetContract = new Contract(
            mainnetContractAddress,
            contractAbi,
            wallet 
        )

        rafflesContract = new Contract(
            rafflesContractAddress,
            rafflessAbi,
            walletArbitrum
        )

        erc721Contract = new Contract(
            erc721Address,
            erc721Abi,
            walletArbitrum
        )

        erc20Contract = new Contract(
            tokenToWhitelistArbitrum,
            erc20Abi,
            walletArbitrum
        )
    })

    it('whitelisting and blacklisting work correctly', async () => {
        // blacklist
        await rafflesContract.toggleCurrency(
            tokenToWhitelistArbitrum,
        )

        try {
            db = await pool.getConnection()
            const rows = await db.query(`SELECT * FROM currencies WHERE address='?'`,
            [
                tokenToWhitelistArbitrum
            ])

            expect(rows.length).to.be.eq(0)
        } catch (e) {
            console.log(e)
        }
        finally {
            if (db) await db.release()
        }

        // whitelist
        await rafflesContract.toggleCurrency(
            tokenToWhitelistArbitrum,
        )

        // get token data 
        const decimals = await erc20Contract.decimals()
        const symbol = await erc20Contract.symbol()

        // check db 
        try {
            db = await pool.getConnection()
            const rows = await db.query(`SELECT * FROM currencies WHERE address=?;`,
                [
                    tokenToWhitelistArbitrum
                ]
            )

            expect(rows[0]['name']).to.be.eq(symbol)
            expect(BigNumber.from(rows[0]['decimals']).toString()).to.be.eq(BigNumber.from(decimals).toString())
        } catch (e) {
            console.log(e)
        }
        finally {
            if (db) await db.release()
        }
    })

    it('saves the correct data for a new raffle', async () => {
        const timestamp = (await providerArbitrum.getBlock("latest")).timestamp
        const raffleData: RaffleData = {
            assetContract: erc721Address,
            raffleOwner: await wallet.getAddress(),
            raffleWinner: ethers.constants.AddressZero,
            raffleState: BigNumber.from(0),
            raffleType: BigNumber.from(0),
            currency: tokenToWhitelistArbitrum,
            MerkleRoot: ethers.constants.HashZero,
            nftIdOrAmount: BigNumber.from(1),
            pricePerTicket: BigNumber.from(10000),
            endTimestamp: BigNumber.from(timestamp).add(60 * 60 * 13),
            numberOfTickets: BigNumber.from(100),
            ticketsSold: BigNumber.from(0),
            minimumTicketsSold: BigNumber.from(0)
        }

        const tx = await rafflesContract.createRaffle(
            raffleData,
            BigNumber.from(0)
        )
        tx.wait()

        console.log('Submitted tx, now waiting for the event to pick up')

        // need to wait some time
        await sleep(1000 * 30)

        // get data from DB
        db = await pool.getConnection()

        const rows = await db.query(`SELECT * FROM raffles ORDER BY raffleId DESC LIMIT 1;`)
        
        expect(rows[0]['raffleType']).to.be.eq('ERC721')
        expect(rows[0]['raffleState']).to.be.eq('IN_PROGRESS')
        expect(rows[0]['assetContract']).to.be.eq(erc721Address)
        expect(BigNumber.from(rows[0]['pricePerTicket']).toString()).to.be.eq(
            BigNumber.from(10000).toString()
        )
        expect(rows[0]['raffleOwner']).to.be.eq(await wallet.getAddress())
        expect(rows[0]['raffleWinner']).to.be.eq(ethers.constants.AddressZero)
        expect(rows[0]['merkleRoot']).to.be.eq(ethers.constants.HashZero)

        await db.release()
    })

    afterAll(() => {
        if (db) db.release()
    })

})