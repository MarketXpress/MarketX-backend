export class MarkReadResponseDto {
  message: string;
  
  notification: {
    id: number;
    title: string;
    message: string;
    isRead: boolean;
    readAt: Date;
  };
}

