import { CheckpointWriters } from "@snapshot-labs/checkpoint";
import { ethers, BigNumber } from 'ethers';

export const writers: CheckpointWriters = {
    handleNewRaffleCreated: async ( { mysql, receipt, block} ) => {
        const event = receipt.events[0] as any;
        const raffleId: number = event.data[0];

        // post object matches fields of Post entity we will
        // define in graphql schema
        const posts = {
            raffleiId: `${raffleId}`,
        };

        await mysql.queryAsync('INSERT IGNORE INTO raffles SET ?', [posts]);

    }
}

// const assetContract = ethers.utils.getAddress(BigNumber.from(event.data[1]).toHexString())

/*
  raffleId: Int!
  assetContract: String!
  raffleOwner: String!
  raffleWinner: String!
  raffleState: String!
  raffleType: String!
  nftIdOrAmount: Int!
  currency: String!
  pricePerTicket: Int!
  merkleRoot: String!
  endTimestamp: Int!
  ticketsSold: Int!
  minimumTicketsSold: Int!
  numberOfTickets: Int!
  assetContractName: String!
  tokenURI: String!
  currencyName: String!
  decimals: Int!
  currencyDecimals: Int!
*/