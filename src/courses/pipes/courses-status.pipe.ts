import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { CourseStatus } from '../courses.service';

@Injectable()
export class CourseStatusPipe implements PipeTransform<
  string | undefined,
  CourseStatus | undefined
> {
  transform(value: string | undefined): CourseStatus | undefined {
    if (value === undefined || value === '') {
      return undefined;
    }
    const allowedStatuses: CourseStatus[] = ['draft', 'published'];

    if (!allowedStatuses.includes(value as CourseStatus)) {
      throw new BadRequestException(allowedStatuses.join(','));
    }
    return value as CourseStatus;
  }
}
