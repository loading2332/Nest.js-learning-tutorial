import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCourseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  title!: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  description?: string;

  @IsInt()
  @Min(0)
  price!: number;

  @IsIn(['draft', 'published'])
  @IsOptional()
  status?: 'draft' | 'published';
}
