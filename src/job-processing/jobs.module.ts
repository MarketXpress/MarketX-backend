import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

@Global()
@Module({
    imports: [
        BullModule.registerQueue(
            { name: 'email' },
            { name: 'orders' },
            { name: 'notifications' }
        ),
    ],
    exports: [BullModule],
})
export class JobsModule { }
