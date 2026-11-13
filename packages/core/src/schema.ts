import { z } from "zod";

/** 前后端共用 DTO 校验（TECH-STACK §7 数据类型约定：时间 ISO 字符串、金额元整数、布尔 0/1）。 */

const iso = z.string().min(1);

export const communitySchema = z.object({
  uid: z.string().min(1),
  id: z.number().int().optional(),
  name: z.string().min(1),
  district: z.string(),
  bizcircle: z.string().nullable(),
  lng: z.number(),
  lat: z.number(),
  buildYear: z.number().int().nullable(),
  buildType: z.string().nullable(),
  propertyType: z.string().nullable(),
  price: z.number().nullable(),
  priceTx: z.number().nullable(),
  priceSrcN: z.number().int().nullable(),
  bargain: z.number().nullable(),
  cycleDays: z.number().int().nullable(),
  txN: z.number().int().nullable(),
  online: z.boolean().nullable(),
  address: z.string().nullable(),
  tags: z.array(z.string()),
  source: z.string().nullable(),
  fetchedAt: iso.nullable(),
  rev: z.number().int(),
});

export const qualityRowSchema = z.object({
  itemKey: z.string().min(1),
  valueNum: z.number().nullable(),
  valueText: z.string().nullable(),
  source: z.string().nullable(),
  fetchedAt: iso.nullable(),
});

export const houseInputSchema = z.object({
  id: z.number().int().optional(),
  communityUid: z.string().min(1),
  label: z.string().min(1),
  listed: z.number(),
  deal: z.number(),
  area: z.number(),
  downRatio: z.number(),
  rate: z.number(),
  years: z.number(),
  income: z.number(),
  renovation: z.number(),
  rent: z.number(),
  feePerSqm: z.number(),
  parking: z.number(),
  floorAdj: z.number(),
  decorAdj: z.number(),
  compUnit: z.number().nullable(),
});

export const pullQuerySchema = z.object({
  since: z.coerce.number().int().min(0).default(0),
  tables: z.string().optional(),
});

export const pushBodySchema = z.object({
  deviceId: z.string().min(1),
  items: z
    .array(
      z.object({
        table: z.string().min(1),
        uid: z.string().min(1),
        op: z.enum(["upsert", "delete"]),
        fields: z.record(z.string(), z.unknown()),
        baseRev: z.number().int().min(0).default(0),
        clientTs: z.string().min(1),
      }),
    )
    .max(500),
});

export type CommunityDTO = z.infer<typeof communitySchema>;
export type HouseInputDTO = z.infer<typeof houseInputSchema>;
