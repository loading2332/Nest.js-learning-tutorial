import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

type Course = {
  id: number;
  title: string;
  description: string;
  price: number;
};

@Controller('courses')
export class CoursesController {
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

  @Get()
  findAll(@Query('keyword') keyword?: string) {
    if (!keyword) {
      return this.courses;
    }

    return this.courses.filter((course) =>
      course.title.toLowerCase().includes(keyword.toLowerCase()),
    );
  }

  @Get(':id') // Param 读取路径参数
  findOne(@Param('id') id: string) {
    const courseId = Number(id);
    const course = this.courses.find((item) => item.id === courseId);

    if (!course) {
      return {
        message: 'No course exist',
      };
    }

    return course;
  }

  @Post()
  create(@Body() body: any) {
    const course: Course = {
      id: this.courses.length + 1,
      title: body.title,
      description: body.description,
      price: body.price,
    };

    this.courses.push(course);

    return course;
  }
}
