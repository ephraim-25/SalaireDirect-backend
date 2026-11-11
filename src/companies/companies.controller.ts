import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CurrentUser, AccessToken } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  /** Liste les entreprises de l'utilisateur */
  @Get()
  findAll(@CurrentUser() user: any, @AccessToken() token: string) {
    return this.companiesService.findAll(user.id, token);
  }

  /** Détail d'une entreprise */
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @AccessToken() token: string,
  ) {
    return this.companiesService.findOne(id, token);
  }

  /** Crée une entreprise et affecte l'utilisateur comme admin */
  @Post()
  create(
    @Body() dto: CreateCompanyDto,
    @CurrentUser() user: any,
    @AccessToken() token: string,
  ) {
    return this.companiesService.create(dto, user.id, token);
  }

  /** Met à jour une entreprise (admin seulement) */
  @Put(':id')
  @Roles('admin')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyDto,
    @AccessToken() token: string,
  ) {
    return this.companiesService.update(id, dto, token);
  }
}
