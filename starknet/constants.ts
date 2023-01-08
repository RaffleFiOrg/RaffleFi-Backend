import dotenv from 'dotenv';
dotenv.config();

export const mainContract: string = String(process.env.MAINCONTRACT)
export const ticketsContract: string = String(process.env.TICKETSCONTRACT)