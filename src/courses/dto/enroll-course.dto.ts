import { IsInt } from 'class-validator';

export class EnrollCourseDto {
  @IsInt()
  userId!: number;
}
