import { prisma } from "@/lib/prisma";

const MAX_SERIAL_RETRIES = 3;

type TransactionClient = Parameters<
  Extract<Parameters<typeof prisma.$transaction>[0], (...args: never[]) => unknown>
>[0];

/**
 * Assigns a serial number to a new job application within a serializable transaction.
 * Retries on unique constraint violations (P2002) caused by concurrent inserts.
 */
export async function withSerialNumber<T>(
  userId: string,
  callback: (tx: TransactionClient, serialNumber: number) => Promise<T>
): Promise<T> {
  for (let attempt = 0; attempt < MAX_SERIAL_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const max = await tx.jobApplication.aggregate({
            where: { userId },
            _max: { serialNumber: true },
          });
          const serialNumber = (max._max.serialNumber ?? 0) + 1;
          return callback(tx, serialNumber);
        },
        { isolationLevel: "Serializable" }
      );
    } catch (error: unknown) {
      const isUniqueViolation =
        error instanceof Error &&
        "code" in error &&
        (error as { code: string }).code === "P2002";
      if (isUniqueViolation && attempt < MAX_SERIAL_RETRIES - 1) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Failed to assign serial number");
}
