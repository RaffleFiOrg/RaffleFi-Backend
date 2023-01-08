import { 
    handleErc20CurrencyAdded, 
    handleErc20CurrencyRemoved, 
    handleNewRaffleCreated, 
    handleNewRaffleTicketBought, 
    handleRaffleStateChanged, 
    handleTicketBoughtFromMarket, 
    handleTicketSellOrderCancelled, 
    handleTicketSellOrderCreated 
} from "./handlerFunctions"

export const events = {
    mainContract: 
        {
            "new_raffle_created": handleNewRaffleCreated,
            "erc20_currency_added": handleErc20CurrencyAdded,
            "erc20_currency_removed": handleErc20CurrencyRemoved,
            "raffle_state_changed": handleRaffleStateChanged,
            "new_raffle_ticket_bought": handleNewRaffleTicketBought
        }
    ,
    ticketsContract: 
        {
            "ticket_sell_order_created": handleTicketSellOrderCreated,
            "ticket_sell_order_cancelled": handleTicketSellOrderCancelled,
            "ticket_bought_from_market": handleTicketBoughtFromMarket
        }
    
}