import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import { createPool } from 'mariadb';
import { FunctionFragment } from "ethers/lib/utils";

async function main() {

    // 10 minutes
    const interval: number = 1000 * 30
    // const interval: number = 1000 * 60 * 10;

    const db_config = {
        host: process.env.DB_ADDRESS,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        connectionLimit: 1  
    }
    
    const pool = createPool(db_config);

    const network = ethers.providers.getNetwork('maticmum');
    const provider = new ethers.providers.AlchemyProvider(network, process.env.BRIDGE_PROVIDER);
    const abiParsed = JSON.parse(fs.readFileSync('./abi/RafflePolygon.json').toString());
    const abi = abiParsed.abi;
    
    const bridgeContract = process.env.CONTRACT_BRIDGE;
    
    // Create the wallet object for our relayer private key 
    const privateKey: string = String(process.env.PRIVATE_KEY);
    const wallet = new ethers.Wallet(privateKey, provider);
    const address = await wallet.getAddress();
    
    // Create the contract object
    const contract = new ethers.Contract(
        String(bridgeContract), 
        abi, 
        provider
    );

    const getRaffles = async (time: number) => {
        let db: any;
        try {
            db = await pool.getConnection();
            const rows = await db.query(
                `SELECT raffleId FROM raffles WHERE raffleState='IN_PROGRESS' 
                AND endTimestamp < ?;`, 
                [time])
            ;
            return rows;
        } catch(error) {
            console.log("Houston we have a problem", error)
        } finally {
            if (db) await db.release() 
        }
    }

    const interfaceABI = new ethers.utils.Interface(abi);
    const sendTx = async (data: any) => {
        try {
            const fragment: FunctionFragment = interfaceABI.getFunction('completeRaffle');
            const encodedData = contract.interface.encodeFunctionData(
                fragment, [data.raffleId]
            );
            const transaction = {
                to: bridgeContract,
                value: ethers.utils.parseEther('0'),
                data: encodedData,
                from: address
            }
            const receipt = await wallet.sendTransaction(transaction);
            await receipt.wait();
            console.log(receipt)
        } catch (err) {
            console.log(err)
        }   
    }

    // Run this every ten minutes
    setInterval(async function() {
        try {
            // calculate the current time in unix epoch 
            const date = new Date()
            const converted = Math.floor(date.getTime() / 1000)
            // Get the raffles which need to be finalized
            const raffles = await getRaffles(converted);
            raffles.forEach(async (raffleId: any) => {
                await sendTx(raffleId);
            });
        } catch(error) {
            console.log(error)
        }
        
    }, interval)
}

main().catch();

