import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import type { CreateCourseBody, UpdateCourseBody } from './courses.service';
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  findAll(@Query('keyword') keyword?: string) {
    return this.coursesService.findAll(keyword);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.coursesService.findOne(Number(id)); // url通常传的是字符串
  }

  @Post()
  create(@Body() body: CreateCourseBody) {
    return this.coursesService.create({
      title: body.title,
      description: body.description,
      price: body.price,
    });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateCourseBody) {
    return this.coursesService.update(Number(id), {
      title: body.title,
      description: body.description,
      price: body.price,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.coursesService.remove(Number(id));
  }
}
