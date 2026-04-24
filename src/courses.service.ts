import { Injectable } from '@nestjs/common';

export type Course = {
  id: number;
  title: string;
  description: string;
  price: number;
};

export type CreateCourseBody = {
  title: string;
  description: string;
  price: number;
};

export type UpdateCourseBody = Partial<CreateCourseBody>;
@Injectable()
export class CoursesService {
  private courses: Course[] = [
    {
      id: 1,
      title: 'NestJS 入门',
      description: '学习 NestJS 的 Controller、Service 和 Module',
      price: 99,
    },
    {
      id: 2,
      title: 'TypeScript 基础',
      description: '学习 TypeScript 常用类型和工程配置',
      price: 59,
    },
  ];

  private getNextId() {
    const maxId = this.courses.reduce((max, course) => {
      return course.id > max ? course.id : max;
    }, 0);

    return maxId + 1;
  }

  findAll(keyword?: string) {
    if (!keyword) {
      return this.courses;
    }
    return this.courses.filter((course) =>
      course.title.toLowerCase().includes(keyword.toLowerCase()),
    );
  }

  findOne(id: number) {
    const course = this.courses.find((item) => item.id === id);

    if (!course) {
      return {
        message: 'no course exist!',
      };
    }

    return course;
  }

  create(input: CreateCourseBody) {
    const course: Course = {
      id: this.getNextId(),
      title: input.title,
      description: input.description,
      price: input.price,
    };
    this.courses.push(course);
    return course;
  }

  update(id: number, input: UpdateCourseBody) {
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
