import { createPool } from 'mariadb';
import fs from 'fs';
import { ethers } from 'ethers';
import { Network, Alchemy, Nft } from 'alchemy-sdk';

require('dotenv').config();

interface NewRaffleCreated {
    raffleId: number 
}

interface RaffleData {
    assetContract: string;
    raffleOwner: string;
    raffleWinner: string;
    raffleState: number;
    raffleType: number;
    currency: string;
    MerkleRoot: string;
    nftIdOrAmount: number;
    pricePerTicket: number;
    endTimestamp: number;
    numberOfTickets: number;
    ticketsSold: number;
    minimumTicketsSold: number;
}

async function main() {

    const db_config = {
        host: process.env.DB_ADDRESS,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        connectionLimit: 5   
    }
    
    const pool = createPool(db_config);

    // The provider for alchemy 
    const alchemyProvider =  new Alchemy({
        apiKey: process.env.MAINNET_KEY, // on prod it will be Ethereum 
        network: Network.ETH_GOERLI, // on prod it will be Ethereum 
        maxRetries: 10
    });

    const l2Chain = String(process.env.L2_CHAIN)

    const rafflesAbiParsed = JSON.parse(fs.readFileSync('./src/abi/RafflePolygon.json').toString());
    const rafflesAbi = rafflesAbiParsed.abi;
    const ERC20Parsed = JSON.parse(fs.readFileSync('./src/abi/ERC20.json').toString());
    const ERC721Parsed = JSON.parse(fs.readFileSync('./src/abi/ERC721.json').toString());
    
    const mainnetNetwork = ethers.providers.getNetwork('goerli')
    const network = l2Chain === 'arbitrum' ? 'arbitrum-goerli' : 'maticmum'
    const l2Network = ethers.providers.getNetwork(network);
    const provider = new ethers.providers.AlchemyProvider(mainnetNetwork, process.env.MAINNET_KEY);
    const providerKey = l2Chain === 'arbitrum' ? process.env.ARBITRUM_KEY : process.env.MUMBAI_KEY
    const l2Provider = new ethers.providers.AlchemyProvider(l2Network, providerKey);
        
    const rafflesContractAddress = l2Chain === 'arbitrum' ? process.env.CONTRACT_ARBITRUM : process.env.CONTRACT_MUMBAI;

    // Sort of enums
    const raffleType = ['ERC721', 'ERC20'];

    const raffleState = [
        'IN_PROGRESS',
        'FINISHED',
        'COMPLETED',
        'REFUNDED',
        'CLAIMED'
    ];

    // Create the polygon contract
    const l2Contract = new ethers.Contract(
        String(rafflesContractAddress),
        rafflesAbi,
        l2Provider
    );

    async function getSymbol(contractAddress: string): Promise<string> {
        try {
            const contract = new ethers.Contract(contractAddress, ERC20Parsed, provider);
            const name: string = await contract.symbol();
            return name;
        } catch (e) {
            return ''
        }
    }

    async function getName(contractAddress: string): Promise<string> {
        try {
            const contract = new ethers.Contract(contractAddress, ERC20Parsed, provider);
            const name: string = await contract.name();
            return name;
        } catch (e) {
            return ''
        }
    }

    async function getDecimals(contractAddress: string): Promise<number> {
        try {
            const contract = new ethers.Contract(contractAddress, ERC20Parsed, provider);
            const decimals: number = await contract.decimals();
            return decimals;
        } catch (e) {
            // by default return 18
            return 18;
        }
    }

    async function getDecimalsPolygon(contractAddress: string): Promise<number> {
        try {
            const contract = new ethers.Contract(contractAddress, ERC20Parsed, l2Provider);
            const decimals: number = await contract.decimals();
            return decimals;
        } catch (e) {
            // by default return 18
            return 18;
        }
    }

    async function getNamePolygon(contractAddress: string): Promise<string> {
        try {
            const contract = new ethers.Contract(contractAddress, ERC20Parsed, l2Provider);
            const name: string = await contract.symbol();
            return name;
        } catch (e) {
            return ''
        }
    }

    async function getTokenURI(contractAddress: string, tokenId: number): Promise<string> {
        try {
            const tokenURI: Nft = await alchemyProvider.nft.getNftMetadata(
                contractAddress, tokenId
            );
            if (tokenURI.metadataError) {
                const contract = new ethers.Contract(contractAddress, ERC721Parsed, provider);
                const tokenURI = await contract.tokenURI();
                return tokenURI;
            } else {
                if (tokenURI.media.length > 0) {
                    return tokenURI.media[0].gateway;
                } else {
                    if (tokenURI.rawMetadata !== undefined) {
                        if (tokenURI.rawMetadata.image) {
                            return tokenURI.rawMetadata.image;
                        }
                    }  
                }
            } 
            return "";
        } catch (e) {
            return "";
        }
    }

    const raffleCreatedFilter = l2Contract.filters.NewRaffleCreated();
    l2Contract.on(raffleCreatedFilter, async (raffleId) => {
        let db;
        try {
            const formatted: NewRaffleCreated = {
                raffleId: raffleId
            }
            db = await pool.getConnection();
            // Get the raffle data
            const raffleData: RaffleData = await l2Contract.raffles(formatted.raffleId);
            let tokenURI: string = '';
            let decimals: number = 18;
            if (raffleData.raffleType === 0) {
                let nftData = await alchemyProvider.nft.getNftMetadata(raffleData.assetContract, raffleData.nftIdOrAmount);
                if (nftData.rawMetadata) {
                    let image = nftData.rawMetadata.image ? nftData.rawMetadata.image : nftData.rawMetadata.image_url;
                    if (image) {
                        if (image.includes('ipfs')) {
                            image = image.replace('ipfs://', 'https://ipfs.io/ipfs/')
                        }
                        tokenURI = image ? image : 'NULL';
                    } else {
                        tokenURI = await getTokenURI(raffleData.assetContract, raffleData.nftIdOrAmount);
                    }

                } else {
                    tokenURI = await getTokenURI(raffleData.assetContract, raffleData.nftIdOrAmount);
                }
            } else {
                decimals = await getDecimals(raffleData.assetContract);
            }

            const name = await getName(raffleData.assetContract)
            const symbol = await getSymbol(raffleData.assetContract)
            const currencyDecimals = await getDecimalsPolygon(raffleData.currency);
            const currencyName = await getNamePolygon(raffleData.currency);

            await db.query(`INSERT INTO raffles(
                    raffleId, assetContract, raffleOwner, raffleWinner, raffleState,
                    raffleType, nftIdOrAmount, currency, pricePerTicket,
                    merkleRoot, endTimestamp, ticketsSold, minimumTicketsSold,
                    numberOfTickets, assetContractName, tokenURI,
                    currencyName, decimals, currencyDecimals, symbol
                )
            
                VALUES(
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                );`, 
                [
                    formatted.raffleId.toString(),
                    raffleData.assetContract,
                    raffleData.raffleOwner,
                    ethers.constants.AddressZero, // winner 
                    raffleState[parseInt(raffleData.raffleState.toString())].toString(),
                    raffleType[parseInt(raffleData.raffleType.toString())].toString(),
                    raffleData.nftIdOrAmount.toString(),
                    raffleData.currency,
                    raffleData.pricePerTicket.toString(),
                    raffleData.MerkleRoot,
                    raffleData.endTimestamp.toString(),
                    raffleData.ticketsSold.toString(),
                    raffleData.minimumTicketsSold.toString(),
                    raffleData.numberOfTickets.toString(),
                    name, 
                    tokenURI === undefined ? '' : tokenURI,
                    currencyName,
                    decimals.toString(),
                    currencyDecimals.toString(),
                    symbol
                ]
            );
        } catch(e) {
            console.log(e);
        } finally {
            if (db) await db.release();
        }
    });

    const ticketBoughtFilter = l2Contract.filters.NewRaffleTicketBought();
    l2Contract.on(ticketBoughtFilter, async (
        raffleId, 
        buyer, 
        numberOfTickets,
        initTicketId,
        endTicketId
        ) => {
        let db;
        try {
            db = await pool.getConnection();
            // First update the total number of tickets 
            await db.query(`UPDATE raffles SET ticketsSold=? WHERE raffleId=?;`, [
                endTicketId.add(1).toString(), 
                raffleId.toString()
            ]);
            // Update the tickets table for the user 
            let data = []
            for (
                let ticketId = parseInt(initTicketId.toString()); 
                ticketId <= parseInt(endTicketId.toString()); 
                ticketId++
                ) {
                data.push([raffleId.toString(), buyer, ticketId.toString()]);
            }
            await db.batch(
                `INSERT INTO tickets (raffleId, account, ticketId) VALUES(?, ?, ?);`,
                data
            );
        } catch(e) {
            console.log(e);
        } finally {
            if (db) await db.release();
        }
    });

    const raffleStateChangedFilter = l2Contract.filters.RaffleStateChanged();
    l2Contract.on(raffleStateChangedFilter, async (
        raffleId, oldRaffleState, newRaffleState) => {
        let db;
        try {
            db = await pool.getConnection();
            await db.query(`UPDATE raffles SET raffleState=? WHERE raffleId=?;`, [
                raffleState[parseInt(newRaffleState.toString())], 
                raffleId.toString()
            ]);
        } catch(e) {
            console.log(e);
        } finally {
            if (db) await db.release();
        }
    });

    const mainnetCallFilter = l2Contract.filters.MainnetCall();
    l2Contract.on(mainnetCallFilter, async (
        receiver, 
        assetContract, 
        isERC721, 
        amountOrNftIdToReceiver, 
        increaseTotalAmountClaimable
        ) => {
        let db;
        try {
            db = await pool.getConnection();
            let date = new Date();
            const timeNow = Math.floor(date.getTime() / 1000);
            await db.query(
                `INSERT INTO callbacks (receiver, assetContract, isERC721, amountOrNftIdToReceiver, increaseTotalAmountClaimable, callBackTimestamp, processed)
                VALUES(?, ?, ?, ?, ?, ?, 'false')
                `,
                [
                    receiver,
                    assetContract,
                    isERC721.toString(),
                    amountOrNftIdToReceiver.toString(),
                    increaseTotalAmountClaimable.toString(),
                    timeNow,
                ]
            );
        } catch(e) {console.log(e);}
        finally { if(db) db.release() };
    })
}

main().catch();