export const schema = `
""" Entity named Raffles """
type Raffles {
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
}
`;
