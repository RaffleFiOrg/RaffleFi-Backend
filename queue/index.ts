import { createPool } from 'mariadb';
import { ethers, BigNumber } from 'ethers';
import { FunctionFragment } from "ethers/lib/utils";
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

async function main() {
    const db_config = {
        host: process.env.DB_ADDRESS,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        connectionLimit: 1  
    }
    
    const pool = createPool(db_config);

    const network = ethers.providers.getNetwork('goerli');
    const provider = new ethers.providers.AlchemyProvider(network, process.env.MAINNET_KEY);
    const abiParsed = JSON.parse(fs.readFileSync('./abi/MainnetEscrow.json').toString());
    const abi = abiParsed.abi;
    
    const mainnetContract = String(process.env.CONTRACT_ETH);
    
    // Create the wallet object for our relayer private key 
    const privateKey: string = String(process.env.PRIVATE_KEY);
    const wallet = new ethers.Wallet(privateKey, provider);
    const address = await wallet.getAddress();
    
    // Create the contract object
    const contract = new ethers.Contract(
        mainnetContract, 
        abi, 
        provider
    );

    // 10 min
    // const interval = 1000 * 60 * 10;
    const interval = 1000 * 60 * 10

    interface CallbacksReturn {
        rows: any[] | null,
        ids: number[] | null,
        error: string | null
    }

    // Get data from the DB 
    const getCallbacks = async () : Promise<CallbacksReturn> => {
        // Get the callbacks that have not been processed from the DB 
        let db: any;
        try {
            db = await pool.getConnection();
            const rows = await db.query(`SELECT id, receiver, 
                assetContract, isERC721, amountOrNftIdToReceiver, 
                increaseTotalAmountClaimable
                FROM callbacks WHERE processed='false' LIMIT 15;`)
            if (rows.length > 0) {
                delete rows.meta 
                const ids = new Array();
                for (const obj of rows) {
                    // save the ID
                    ids.push(obj.id)
                    // remove the ID from the object
                    delete obj.id
                }
                return {
                    rows: rows,
                    ids: ids,
                    error: null
                }
            } else {
                return {
                    rows: null,
                    ids: null,
                    error: "No data"
                }
            }
        } catch(error: any) {
            return {
                rows: null,
                ids: null,
                error: error.toString()
            }
        } finally {
            if (db) await db.release() 
        }
    }

    // Update the callbacks as processed
    const updateTables = async (ids: number[]) => {
        let db: any;
        try {
            db = await pool.getConnection()
            await db.query(`UPDATE callbacks SET processed='true' WHERE id IN (?);`, [
                ids
            ]);
        } catch(error) {
            console.log(error)
        } finally {
            if (db) await db.release()
        }
    }

    // Send the callbacks to mainnet
    const interfaceABI = new ethers.utils.Interface(abi)
    const sendTxToMainnet = async (data: any) : Promise<boolean> => {
        try {
            // Check gas price first
            const gasPrice = await wallet.provider.getFeeData()
            if (gasPrice.gasPrice?.gt(BigNumber.from('200000000000'))) return false;

            // encode tx data
            const fragment: FunctionFragment = interfaceABI.getFunction('polygonCallback')
            const encodedData = contract.interface.encodeFunctionData(
                fragment, [data]
            );

            const transaction = {
                to: mainnetContract,
                data: encodedData,
                from: address
            }

            // send 
            const receipt = await wallet.sendTransaction(transaction)
            const res = await receipt.wait()

            // check res
            if (res.status !== 1) {
                return false
            } else {
                return true
            }
        } catch (err) { 
            return false 
        }
    }

    setInterval(async function () {
        const callbacks: CallbacksReturn = await getCallbacks();
        if (callbacks.error === null && callbacks.rows && callbacks.ids) {
            // send txs 
            const res = await sendTxToMainnet(callbacks.rows)
            if (res) await updateTables(callbacks.ids)
        } 
    }, interval);
}

main().catch();