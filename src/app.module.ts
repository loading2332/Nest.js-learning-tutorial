import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoursesModule } from './courses/courses.module';
import { UsersModule } from './users/users.module';
@Module({
  imports: [CoursesModule, UsersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
