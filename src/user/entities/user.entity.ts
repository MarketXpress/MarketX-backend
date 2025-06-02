import { Wallet } from "src/wallet/entities/wallet.entity";
import { OneToOne } from "typeorm";

export class User {

@OneToOne(() => Wallet, wallet => wallet.user, { cascade: true })
wallet: Wallet;

}
