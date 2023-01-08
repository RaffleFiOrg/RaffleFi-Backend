import express from 'express';
import dotenv from 'dotenv'
import cors from 'cors';
import { ethers, BigNumber } from 'ethers';
import { Alchemy, Network, FloorPriceError, FloorPriceMarketplace, GetFloorPriceResponse } from 'alchemy-sdk';
import bodyParser from 'body-parser';
import keccak256 from 'keccak256';
import { MerkleTree } from 'merkletreejs';
import { createPool, Pool } from 'mariadb';
import fs from 'fs';

dotenv.config();

// The provider for alchemy 
const alchemyProvider =  new Alchemy({
    apiKey: process.env.MAINNET_KEY, // on prod it will be Ethereum 
    network: Network.ETH_MAINNET, // on prod it will be Ethereum 
    maxRetries: 10
})

const app = express();
app.use(bodyParser.json({limit: "550mb"}));
app.use(bodyParser.urlencoded({limit: "550mb", extended: true, parameterLimit:50000}));
var corsOptions = {
    origin: '*',
    // origin: 'https://www.rafflefi.xyz'
    optionSuccessStatus: 200,
    methods: ['GET', 'POST']
}
app.use(cors(corsOptions));
app.use(express.json());
app.options('*', cors());

const db_config = {
    host: process.env.DB_ADDRESS,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 5   
}

const ERC721Parsed = JSON.parse(fs.readFileSync('./ERC721.json').toString());
const network = ethers.providers.getNetwork(1);
const provider = new ethers.providers.AlchemyProvider(network, process.env.MAINNET_KEY);

const pool: Pool = createPool(db_config);

app.post("/create-lottery", async function(req, res) {
    const data: string[] = req.body['addresses'];
    const month: number = req.body['month'];
    try {
        const err = await createMerkleTree(data, month);
        console.error(err);
        if (err) res.status(500).json(err);
        else res.status(200).json("Success");
    } catch(err) {
        console.log(err);
        res.status(500).json(err);
    } 
});

const isError = (obj: Object) => {
    return 'error' in obj;
}

const createMerkleTree = async (addresses: string[], month: number) : Promise<string> => {
    const leafNodes = new Array();
    const floorPrices = new Array();
    const allShares = new Array();
    const names = new Array();
    let counter: number = 1;

    const callback = async () => {
        // Create the tree and get root hash 
        const merkleTree = new MerkleTree(leafNodes, keccak256, {sortPairs: true});
        const rootHash = `0x${merkleTree.getRoot().toString("hex")}`
        let counter: number = 1;
        // Loop through the data and save to S3 
        for await (const [index, leaf] of leafNodes.entries()) {
            // try to save to db 
            let db: any;
            try {
                db = await pool.getConnection();
                const proof = merkleTree.getHexProof(leaf).toString();
                const buff = Buffer.from(proof).toString('base64');
                await db.query(`INSERT INTO monthly_lottery_erc721_shares VALUES(
                    ?, ?, ?, ?, ?
                );`, [
                    addresses[index], 
                    names[index], 
                    floorPrices[index], 
                    allShares[index], 
                    buff.toString()
                ]);
            } catch (e) {
                console.log(e);
                return "Failed to save to db";
            } finally {
                if (db) await db.release();
            }

            counter++;
            if (counter === addresses.length) {
                // save to db
                let db: any;
                try {
                    db = await pool.getConnection();
                    await db.query(`INSERT INTO monthly_lottery_erc721(merkle_root) VALUES(?);`, [rootHash]);
                } catch (e) {
                    console.log(e)
                    return "Failed to add to DB"
                } finally {
                    if (db) await db.release();
                }
            }
        }
    }
    
    // await version 
    for await (const address of addresses) {
        // check if address 
        if (!ethers.utils.isAddress(address)) return "Not a valid address";
        const floorPrice: GetFloorPriceResponse = await alchemyProvider.nft.getFloorPrice(address);
        const floorPriceOpenSea: FloorPriceMarketplace | FloorPriceError = floorPrice.openSea;
        const floorPriceLooksRare: FloorPriceMarketplace | FloorPriceError = floorPrice.looksRare;
        let actualFloorPrice: number = 0;
        if (isError(floorPriceOpenSea) && isError(floorPriceLooksRare)) {
            return `No floor price for ${address}`;
        } 
        if ('floorPrice' in floorPriceOpenSea ) {
            actualFloorPrice = floorPriceOpenSea.floorPrice;
        } else if ('floorPrice' in floorPriceLooksRare) {
            actualFloorPrice = floorPriceLooksRare.floorPrice;
        }
        if (actualFloorPrice === 0) return "Error with floor price";
        // shares == floorPrice * 1e18
        const shares_ = ethers.utils.parseEther(actualFloorPrice.toString()).toString()
        floorPrices.push(actualFloorPrice);
        allShares.push(shares_);
        // leaves -> floorPrice:shares
        leafNodes.push(keccak256(`${actualFloorPrice}:${shares_}`));
        const contract = new ethers.Contract(
            address, ERC721Parsed, provider
        )
        const name = await contract.name();
        names.push(name);
        counter++;
        if (counter === addresses.length) {
            console.log("there")
            await callback();
        } 
    }

    return "";
}

interface CustomLotteryData {
    address: string,
    shares: BigNumber
}

// TODO custom lotteries
// projects can pay us to be in the NFT list 
app.post('/custom/lottery', async function (req, res) {
    const data: CustomLotteryData[] = req.body['lotteryData'];
    const month: number = req.body['month'];

})

app.listen(8003);