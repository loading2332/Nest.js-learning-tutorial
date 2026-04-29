import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLessonDto } from './dto/create-lesson.dto';

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
      include: {
        lessons: {
          orderBy: {
            sortOrder: 'asc',
          },
        },
      },
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

  async createLesson(courseId: number, input: CreateLessonDto) {
    await this.findOne(courseId);
    return this.prisma.lesson.create({
      data: {
        title: input.title,
        content: input.content,
        sortOrder: input.sortOrder ?? 0,
        courseId,
      },
    });
  }

  async enroll(courseId: number, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
      });
      if (!user) {
        throw new NotFoundException('user not found');
      }
      const course = await tx.course.findUnique({
        where: { id: courseId },
      });
      if (!course) {
        throw new NotFoundException('course not found');
      }
      const existingEnrollment = await tx.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId,
            courseId,
          },
        },
      });
      if (existingEnrollment) {
        throw new BadRequestException('already enrolled');
      }
      return tx.enrollment.create({
        data: {
          userId,
          courseId,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          course: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });
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
