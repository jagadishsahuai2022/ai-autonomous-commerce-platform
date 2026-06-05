import { Injectable } from '@nestjs/common';
import { CreateAddressDto, UpdateAddressDto } from './address.dto';
import { Address } from './address.entity';

/**
 * Address Service - Stub implementation
 * TODO: Replace with Prisma implementation when Address model is added to schema
 */
@Injectable()
export class AddressService {
  private addresses: Address[] = [];

  async create(userId: string, createAddressDto: CreateAddressDto): Promise<Address> {
    const address: Address = {
      id: crypto.randomUUID(),
      userId,
      ...createAddressDto,
      country: createAddressDto.country || 'IN',
      isDefault:
        createAddressDto.isDefault ??
        this.addresses.filter((a) => a.userId === userId).length === 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (address.isDefault) {
      this.addresses = this.addresses.map((a) =>
        a.userId === userId ? { ...a, isDefault: false } : a
      );
    }

    this.addresses.push(address);
    return address;
  }

  async findAll(userId: string): Promise<Address[]> {
    return this.addresses
      .filter((a) => a.userId === userId && a.isActive)
      .sort((a, b) => {
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
  }

  async findOne(id: string, userId: string): Promise<Address | null> {
    return this.addresses.find((a) => a.id === id && a.userId === userId) || null;
  }

  async findDefault(userId: string): Promise<Address | null> {
    return (
      this.addresses.find((a) => a.userId === userId && a.isDefault && a.isActive) ||
      this.addresses.find((a) => a.userId === userId && a.isActive) ||
      null
    );
  }

  async update(
    id: string,
    userId: string,
    updateAddressDto: UpdateAddressDto
  ): Promise<Address | null> {
    const index = this.addresses.findIndex((a) => a.id === id && a.userId === userId);
    if (index === -1) return null;

    if (updateAddressDto.isDefault && !this.addresses[index].isDefault) {
      this.addresses = this.addresses.map((a) =>
        a.userId === userId ? { ...a, isDefault: false } : a
      );
    }

    this.addresses[index] = {
      ...this.addresses[index],
      ...updateAddressDto,
      updatedAt: new Date(),
    };
    return this.addresses[index];
  }

  async delete(id: string, userId: string): Promise<void> {
    const address = this.addresses.find((a) => a.id === id && a.userId === userId);
    if (!address) return;

    address.isActive = false;

    if (address.isDefault) {
      const next = this.addresses.find((a) => a.userId === userId && a.isActive && a.id !== id);
      if (next) next.isDefault = true;
    }
  }

  async setDefault(id: string, userId: string): Promise<Address | null> {
    const address = this.addresses.find((a) => a.id === id && a.userId === userId);
    if (!address) return null;

    this.addresses = this.addresses.map((a) =>
      a.userId === userId ? { ...a, isDefault: a.id === id } : a
    );
    return { ...address, isDefault: true };
  }
}
