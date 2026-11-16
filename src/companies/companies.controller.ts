import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import {
  AccessToken,
  CompanyId,
} from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * L'entreprise d'un compte est créée automatiquement à la première connexion
 * (voir CompanyContextService) : il n'y a donc plus de route de création publique.
 */
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  /** Entreprise de l'utilisateur connecté */
  @Get('current')
  findCurrent(@CompanyId() companyId: string, @AccessToken() token: string) {
    return this.companiesService.findOne(companyId, companyId, token);
  }

  /** Détail d'une entreprise (uniquement la sienne) */
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CompanyId() companyId: string,
    @AccessToken() token: string,
  ) {
    return this.companiesService.findOne(id, companyId, token);
  }

  /** Met à jour son entreprise (administrateur uniquement) */
  @Put(':id')
  @Roles('admin')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompanyDto,
    @CompanyId() companyId: string,
    @AccessToken() token: string,
  ) {
    return this.companiesService.update(id, dto, companyId, token);
  }
}
