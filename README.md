# RaffleFi-Backend

Backend services for RaffleFi. These services interact with 

## Services

| Service | Directory |  Description |
| - |-| - |
|Mainnet | mainnet | A private microservice for the MainnetEscrow contract which talks to Alchemy to listen to contract events. It sends transactions to the bridge and can talk to the RDS DB. |
|  Bridge | bridge | A private microservice for the Bridge which talks to Alchemy to listen to contract events. It can talk to the RDS DB.|
| Tickets Listener| tickets | Private microservice for the RafflesTickets contract. Talks to Alchemy and RDS. |
| Weekly Lottery Listener| weeklylottery | Private microservice for the Weekly lottery contract. Talks to Alchemy and RDS. |
|Monthly Lottery Listener | monthlylottery | Private microservice for the Monthly lottery contract. Talks to Alchemy and RDS.|
| Lotterybackend| lotterybackend | Internal service that is used to create ERC721 monthly lotteries.|
| Queue| queue | Internal service which queries the DB for active callbacks and sends them to the mainnet contract. Has external connectivity.|
| Raffle Complete| rafflecomplete |  Internal service to send calls to the Raffles contract to complete a raffle. Has external connectivity.|
| Starknet Backend | starknet | TODO | 

## Installation

Clone this repo, `cd` to the individual directories and run `yarn` to install the dependencies. 

All projects have been tested with node version 16.

## Testing

Download the `e2e` package, run all services here and `yarn start` on the e2e dir.