import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { PrismaService } from '../prisma/prisma.service';

export type CourseStatus = 'draft' | 'published';

export type Course = {
  id: number;
  title: string;
  description?: string;
  price: number;
  status: CourseStatus;
};
export type FindCourseQuery = {
  keyword?: string;
  status?: CourseStatus;
  page: number;
  limit: number;
};
@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(query: FindCourseQuery) {
    const { keyword, status, page, limit } = query;
    const skip = (page - 1) * limit;
    const where = {
      ...(keyword
        ? {
            title: {
              contains: keyword,
              mode: 'insensitive' as const,
            },
          }
        : {}),
      ...(status ? { status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          id: 'asc',
        },
      }),
      this.prisma.course.count({ where }),
    ]);
    return {
      items,
      meta: {
        total,
        page,
        limit,
      },
    };
  }

  async findOne(id: number) {
    const course = await this.prisma.course.findUnique({
      where: { id },
    });
    if (!course) {
      throw new NotFoundException('course not found');
    }
    return course;
  }

  async create(input: CreateCourseDto) {
    const existCourse = await this.prisma.course.findUnique({
      where: {
        title: input.title,
      },
    });
    if (existCourse) {
      throw new BadRequestException('already exists');
    }
    return this.prisma.course.create({
      data: {
        title: input.title,
        description: input.description,
        price: input.price,
        status: input.status ?? 'draft',
      },
    });
  }

  async update(id: number, input: UpdateCourseDto) {
    await this.findOne(id);
    return this.prisma.course.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        price: input.price,
        status: input.status,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.course.delete({
      where: { id },
    });
  }
}
