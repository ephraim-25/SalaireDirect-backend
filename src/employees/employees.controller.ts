import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { AccessToken } from '../auth/decorators/current-user.decorator';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  findAll(
    @Query('companyId') companyId: string,
    @Query('status') status: string,
    @AccessToken() token: string,
  ) {
    return this.employeesService.findAll(companyId, token, status);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @AccessToken() token: string,
  ) {
    return this.employeesService.findOne(id, token);
  }

  @Post()
  create(
    @Body() dto: CreateEmployeeDto & { company_id?: string },
    @AccessToken() token: string,
  ) {
    return this.employeesService.create(dto, token);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @AccessToken() token: string,
  ) {
    return this.employeesService.update(id, dto, token);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Query('permanent') permanent: string,
    @AccessToken() token: string,
  ) {
    if (permanent === 'true') {
      return this.employeesService.deletePermanent(id, token);
    }
    return this.employeesService.deactivate(id, token);
  }
}
