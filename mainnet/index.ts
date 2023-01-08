import { pool } from "./db";
import fs from 'fs';
import { BigNumber, constants, ethers } from 'ethers';
import * as dotenv from 'dotenv'
import { FunctionFragment } from "ethers/lib/utils";
dotenv.config();

async function main() {
    const abiParsed = JSON.parse(fs.readFileSync('./src/abi/MainnetEscrow.json').toString());
    const abi = abiParsed.abi;
    const arbitrumAbiParsed = JSON.parse(fs.readFileSync('./src/abi/RafflePolygon.json').toString());
    const arbitrumAbi = arbitrumAbiParsed.abi;
    const ERC20Parsed = JSON.parse(fs.readFileSync('./src/abi/ERC20.json').toString());
    
    const l2Chain = String(process.env.L2_CHAIN)
    const mainnetNetwork = ethers.providers.getNetwork('goerli')
    const networkName = l2Chain === 'arbitrum' ? 'arbitrum-goerli' : 'maticmum'
    const l2Network = ethers.providers.getNetwork(networkName);
    const provider = new ethers.providers.AlchemyProvider(mainnetNetwork, process.env.MAINNET_KEY);
    const providerKey = l2Chain === 'arbitrum' ? process.env.ARBITRUM_KEY : process.env.MUMBAI_KEY
    const l2Provider = new ethers.providers.AlchemyProvider(l2Network, providerKey);
        
    const l2ContractAddress = l2Chain === 'arbitrum' ? process.env.CONTRACT_ARBITRUM : process.env.CONTRACT_MUMBAI;
    const mainnetContract = process.env.CONTRACT_ETH;
    
    // Create the wallet object for our relayer private key 
    const privateKey: string = String(process.env.PRIVATE_KEY);
    const wallet = new ethers.Wallet(privateKey, l2Provider);
    const address = await wallet.getAddress();

    // Create the contract object
    const contract = new ethers.Contract(
        String(mainnetContract), 
        abi, 
        provider
    );

    // Create the L2 contract
    const l2Contract = new ethers.Contract(
        String(l2ContractAddress),
        arbitrumAbi,
        l2Provider
    )
    
    // decimals will be on L2 
    async function getDecimals(contractAddress: string): Promise<number> {
        try {
            const targetContract = new ethers.Contract(contractAddress, ERC20Parsed, l2Provider);
            const decimals = await targetContract.decimals()
            return decimals;
        } catch(e) {
            return 18;
        }
    }

    // name will be on L2 
    async function getName(contractAddress: string): Promise<string> {
        try {
            const targetContract = new ethers.Contract(contractAddress, ERC20Parsed, l2Provider);
            const name = await targetContract.symbol();
            return name;
        } catch(e) {
            return '';
        }
    }

    // send the tx to L2 
    const interfaceABI = new ethers.utils.Interface(arbitrumAbi)
    async function sendTxToL2(tx: String|BigNumber[], fairRaffleFee: BigNumber) {
        const fragmMent: FunctionFragment = interfaceABI.getFunction('createRaffle');
        const encodedData = l2Contract
        .interface
        .encodeFunctionData(fragmMent, [tx, fairRaffleFee]);
        const transaction = {
            to: l2ContractAddress,
            value: ethers.utils.parseEther('0'),
            data: encodedData,
            from: address,
        }
        const receipt = await wallet.sendTransaction(transaction);
        await receipt.wait();
    }
        
    // Listen for a new currency added event 
    const addedFilter = contract.filters.ERC20CurrencyAdded();
    contract.on(addedFilter, async (currency) => {
        let db;
        try {
            const decimals: number = currency === constants.AddressZero ? 18 : await getDecimals(currency);
            const name: string = currency === constants.AddressZero ? l2Chain === 'arbitrum' ? 'Ether' : 'Matic' : await getName(currency);
            db = await pool.getConnection();
            await db.query(`INSERT INTO currencies VALUES(?, ?, ?);`, [currency, name, decimals]);
        } catch(e) {
            console.log(e)
        } finally {
            if (db) await db.release();
        }
    });
    
    // Listen for a currency being removed
    const removedFilter = contract.filters.ERC20CurrencyRemoved();
    contract.on(removedFilter, async (currency) => {
        let db;
        try {
            db = await pool.getConnection();
            await db.query(`DELETE FROM currencies WHERE address=?;`, [currency]);
        } catch(e) {
            console.log(e);
        } finally {
            if (db) await db.release();
        }
    });

    const newFilter = contract.filters.RaffleCreated();
    contract.on(newFilter, async (
        assetRaffled, 
        raffleOwner, 
        raffleType,
        nftIdOrAmount,
        paymentCurrency,
        pricePerTicket,
        numberOfTotalTickets,
        minimumTicketsSold,
        endTimestamp,
        merkleRoot,
        fairRaffleFee
        ) => {
        try {
            const raffleData= [
                assetRaffled,
                raffleOwner,
                ethers.constants.AddressZero,
                BigNumber.from(0),
                raffleType,
                paymentCurrency,
                merkleRoot,
                nftIdOrAmount,
                pricePerTicket,
                endTimestamp,
                numberOfTotalTickets,
                BigNumber.from(0),
                minimumTicketsSold
            ]
            await sendTxToL2(raffleData, fairRaffleFee);
        } catch(e) {
            console.log(e);
        }
    });
}

main().catch();
