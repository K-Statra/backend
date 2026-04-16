import { PipeTransform } from '@nestjs/common';
export declare class ParseMongoIdPipe implements PipeTransform<string, string> {
    transform(value: string): string;
}
