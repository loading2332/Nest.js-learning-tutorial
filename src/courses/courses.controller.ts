import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CourseStatusPipe } from './pipes/courses-status.pipe';
import type { CourseStatus } from './courses.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('keyword') keyword?: string,
    @Query('status', CourseStatusPipe) status?: CourseStatus,
  ) {
    return this.coursesService.findAll({
      page,
      limit,
      keyword,
      status,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.coursesService.findOne(id); // url通常传的是字符串
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() body: CreateCourseDto) {
    return this.coursesService.create(body);
  }

  @Post(':id/lessons')
  createLesson(
    @Param('id', ParseIntPipe) courseId: number,
    @Body() body: CreateLessonDto,
  ) {
    return this.coursesService.createLesson(courseId, body);
  }
  @UseGuards(JwtAuthGuard)
  @Post(':courseId/enrollments')
  enroll(
    @Param('courseId', ParseIntPipe) courseId: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.coursesService.enroll(courseId, userId);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateCourseDto) {
    return this.coursesService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.coursesService.remove(id);
  }
}
