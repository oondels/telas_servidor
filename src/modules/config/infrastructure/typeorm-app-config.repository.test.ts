import { describe, expect, it, vi } from "vitest";
import { DEFAULT_ADDRESS_MAX_CAPACITY } from "../domain/app-config.js";
import { TypeOrmAppConfigRepository } from "./typeorm-app-config.repository.js";

describe("TypeOrmAppConfigRepository address capacity", () => {
  it("uses 100 as the default maximum capacity", async () => {
    const repository = {
      findOne: vi.fn().mockResolvedValue(null),
    };
    const configRepository = new TypeOrmAppConfigRepository({
      getRepository: vi.fn().mockReturnValue(repository),
    } as never);

    await expect(configRepository.getAddressMaxCapacityConfig()).resolves.toMatchObject({
      maxCapacity: DEFAULT_ADDRESS_MAX_CAPACITY,
    });
  });

  it("persists a valid maximum capacity", async () => {
    const entity = {
      key: "capacidade_maxima_endereco",
      value: { maxCapacity: 100 },
      updated_at: new Date(),
      updated_by: "123",
    };
    const repository = {
      findOne: vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(entity),
      create: vi.fn().mockImplementation((value) => ({ ...value })),
      save: vi.fn().mockImplementation(async (value) => {
        Object.assign(entity, value);
        return value;
      }),
    };
    const configRepository = new TypeOrmAppConfigRepository({
      getRepository: vi.fn().mockReturnValue(repository),
    } as never);

    await expect(configRepository.updateAddressMaxCapacityConfig(250, 123))
      .resolves.toMatchObject({ maxCapacity: 250, updatedBy: 123 });
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
      value: { maxCapacity: 250 },
      updated_by: "123",
    }));
  });

  it("rejects an invalid configurable maximum", async () => {
    const configRepository = new TypeOrmAppConfigRepository({} as never);

    await expect(configRepository.updateAddressMaxCapacityConfig(0, 123))
      .rejects.toMatchObject({ code: "CAPACIDADE_MAXIMA_INVALIDA" });
    await expect(configRepository.updateAddressMaxCapacityConfig(10001, 123))
      .rejects.toMatchObject({ code: "CAPACIDADE_MAXIMA_INVALIDA" });
  });
});
