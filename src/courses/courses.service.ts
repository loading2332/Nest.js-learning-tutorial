import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

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
  private courses: Course[] = [
    {
      id: 1,
      title: 'NestJS 入门',
      description: '学习 NestJS 的 Controller、Service 和 Module',
      price: 99,
      status: 'published',
    },
    {
      id: 2,
      title: 'TypeScript 基础',
      description: '学习 TypeScript 常用类型和工程配置',
      price: 59,
      status: 'published',
    },
  ];

  private getNextId() {
    const maxId = this.courses.reduce((max, course) => {
      return course.id > max ? course.id : max;
    }, 0);

    return maxId + 1;
  }

  findAll(query: FindCourseQuery) {
    const { keyword, status, page, limit } = query;
    let result = this.courses;
    if (keyword) {
      result = result.filter((course) =>
        course.title.toLowerCase().includes(keyword.toLowerCase()),
      );
    }
    if (status) {
      result = result.filter((course) => course.status === status);
    }
    const start = (page - 1) * limit;
    const end = start + limit;

    return result.slice(start, end);
  }

  findOne(id: number) {
    const course = this.courses.find((item) => item.id === id);

    if (!course) {
      throw new NotFoundException('Not Exists')
    }

    return course;
  }

  create(input: CreateCourseDto) {
    const existCourse = this.courses.find((course) => course.title === input.title)
    if (existCourse) {
      throw new BadRequestException('already exists')
    }
    const course: Course = {
      id: this.getNextId(),
      title: input.title,
      description: input.description,
      price: input.price,
      status: input.status ?? 'draft',
    };
    this.courses.push(course);
    return course;
  }

  update(id: number, input: UpdateCourseDto) {
    const course = this.courses.find((item) => item.id === id);
    if (!course) {
      return {
        message: 'no course exists',
      };
    }

    Object.assign(course, input);
    return course;
  }

  remove(id: number) {
    const index = this.courses.findIndex((item) => item.id === id);

    if (index === -1) {
      return {
        message: 'no course exists!',
      };
    }

    const [removedCourse] = this.courses.splice(index, 1);

    return removedCourse;
  }
}
