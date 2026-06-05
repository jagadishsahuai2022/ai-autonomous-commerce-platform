import {
  IsString,
  IsEmail,
  IsPhoneNumber,
  IsPostalCode,
  IsBoolean,
  IsOptional,
  Length,
} from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @Length(1, 100)
  label: string;

  @IsString()
  @Length(1, 100)
  firstName: string;

  @IsString()
  @Length(1, 100)
  lastName: string;

  @IsPhoneNumber('IN')
  phone: string;

  @IsEmail()
  email: string;

  @IsString()
  addressLine1: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsString()
  @Length(1, 50)
  city: string;

  @IsString()
  @Length(1, 50)
  state: string;

  @IsString()
  @Length(5, 10)
  postalCode: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto extends CreateAddressDto {}

export class AddressResponseDto {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
