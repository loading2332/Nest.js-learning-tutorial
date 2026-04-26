import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateCourseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @IsOptional()
  title?: string;

  @IsString()
  @MaxLength(200)
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsIn(['draft', 'published'])
  @IsOptional()
  status?: 'draft' | 'published';
}
