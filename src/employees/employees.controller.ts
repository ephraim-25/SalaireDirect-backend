import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import {
  AccessToken,
  CompanyId,
} from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  findAll(
    @CompanyId() companyId: string,
    @Query('status') status: string,
    @AccessToken() token: string,
  ) {
    return this.employeesService.findAll(companyId, token, status);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CompanyId() companyId: string,
    @AccessToken() token: string,
  ) {
    return this.employeesService.findOne(id, companyId, token);
  }

  @Post()
  create(
    @Body() dto: CreateEmployeeDto,
    @CompanyId() companyId: string,
    @AccessToken() token: string,
  ) {
    return this.employeesService.create(dto, companyId, token);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
    @CompanyId() companyId: string,
    @AccessToken() token: string,
  ) {
    return this.employeesService.update(id, dto, companyId, token);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('permanent') permanent: string,
    @CompanyId() companyId: string,
    @AccessToken() token: string,
  ) {
    if (permanent === 'true') {
      return this.employeesService.deletePermanent(id, companyId, token);
    }
    return this.employeesService.deactivate(id, companyId, token);
  }
}
