import { BadRequestException } from '@nestjs/common';
import { ParseMongoIdPipe } from './parse-mongo-id.pipe';

describe('ParseMongoIdPipe', () => {
  const pipe = new ParseMongoIdPipe();

  it('유효한 ObjectId → 그대로 반환', () => {
    const id = '507f1f77bcf86cd799439011';
    expect(pipe.transform(id)).toBe(id);
  });

  it('짧은 문자열 → BadRequestException', () => {
    expect(() => pipe.transform('abc')).toThrow(BadRequestException);
  });

  it('빈 문자열 → BadRequestException', () => {
    expect(() => pipe.transform('')).toThrow(BadRequestException);
  });

  it('특수문자 포함 → BadRequestException', () => {
    expect(() => pipe.transform('507f1f77bcf86cd79943901!')).toThrow(
      BadRequestException,
    );
  });
});
