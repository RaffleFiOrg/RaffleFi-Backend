jest.setTimeout(900000)
import { expect } from "chai";
import { ethers, Contract, BigNumber, Wallet } from "ethers";
import dotenv from 'dotenv'
import fs from 'fs'
import { pool } from "../db";
dotenv.config()

let mainnetContract: Contract 
let erc20Contract: Contract
const mainnetContractAddress: string = String(process.env.CONTRACT_ETH)
const privateKey: string = String(process.env.PRIVATE_KEY)
const contractAbi = JSON.parse(
    fs.readFileSync(
        './src/abi/MainnetEscrow.json'
    ).toString()
).abi 

const erc20Abi = JSON.parse(
    fs.readFileSync(
        './src/abi/ERC20.json'
    ).toString()
)

let provider
let providerArbitrum 
let wallet: Wallet
let walletArbitrum: Wallet 

const tokenToWhitelistArbitrum = "0x098A97265e0a9F227514E39Bc7E0ffCD98bd41a7"
const tokenToWhitelistMainnet = "0x9c549A8c35C99836Cc5D6a79ec95481DFDFca7bE"

const mainnetNetwork = ethers.providers.getNetwork('goerli')
const arbitrumNetwork = ethers.providers.getNetwork('arbitrum-goerli')

describe('Mainnet listener', () => {
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
        erc20Contract = new Contract(
            tokenToWhitelistArbitrum,
            erc20Abi,
            walletArbitrum
        )
    })

    it('removes the data from the DB when blacklisting a currency', async () => {
        await mainnetContract.blacklistCurrency(
            tokenToWhitelistArbitrum,
        )

        let db 
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
    })

    it('Stores the correct data in the DB when a currency is whitelisted', async () => {
        // whitelist
        await mainnetContract.whitelistCurrency(
            tokenToWhitelistArbitrum,
            tokenToWhitelistMainnet
        )

        // get token data 
        const decimals = await erc20Contract.decimals()
        const symbol = await erc20Contract.symbol()

        // check db 
        let db
        try {
            db = await pool.getConnection()
            const rows = await db.query(`SELECT * FROM currencies WHERE address=?;`,
                [
                    tokenToWhitelistArbitrum
                ]
            )

            expect(rows[0]['name']).to.be.eq(symbol)
            expect(BigNumber.from(rows[0]['decimals'])).to.be.eq(decimals)
        } catch (e) {
            console.log(e)
        }
        finally {
            if (db) await db.release()
        }
    })
})