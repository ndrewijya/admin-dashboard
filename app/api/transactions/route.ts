import { NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";

// Define transaction type for TypeScript
interface Transaksi {
	id: string;
	anggota_id: string;
	tipe_transaksi: string; // This field contains 'masuk' or 'keluar'
	source_type?: string;
	deskripsi?: string;
	jumlah: number;
	sebelum?: number;
	sesudah?: number;
	pembiayaan_id?: string;
	tabungan_id?: string;
	created_at: string;
	updated_at: string;
	anggota?: { nama: string; nomor_rekening: string } | null;
	tabungan?: {
		saldo: number;
		jenis_tabungan_id: string;
		jenis_tabungan?: {
			nama: string;
			kode: string;
		} | null;
	} | null;
	pinjaman?: {
		id: string;
		jumlah: number;
		sisa_pembayaran: number;
		jenis_pinjaman: string;
	} | null;
}

export async function GET() {
	try {
		console.log(
			"Fetching transactions from Supabase using RPC function..."
		);

		// Use the RPC function to fetch transactions with all related data
		const { data, error } = await supabase
			.rpc("get_all_transactions")
			.limit(100);

		if (error) {
			console.error("Error fetching transactions:", error);
			return NextResponse.json(
				{ error: error.message },
				{ status: 500 }
			);
		}

		// Define the type for our RPC function result
		type TransactionRPCResult = {
			id: string;
			anggota_id: string;
			tipe_transaksi: string; // This field contains 'masuk' or 'keluar'
			source_type: string | null;
			deskripsi: string | null;
			jumlah: number;
			sebelum: number;
			sesudah: number;
			pembiayaan_id: string | null;
			tabungan_id: string | null;
			created_at: string;
			updated_at: string;
			anggota_nama: string | null;
			anggota_nomor_rekening: string | null;
			tabungan_saldo: number | null;
			tabungan_jenis_id: string | null;
			tabungan_jenis_nama: string | null;
			tabungan_jenis_kode: string | null;
			pembiayaan_jumlah: number | null;
			pembiayaan_sisa: number | null;
			pembiayaan_jenis: string | null;
		};

		// Transform the flat data structure into the nested structure expected by the frontend
		const transformedData =
			data?.map((item: TransactionRPCResult) => {
				// Ensure jumlah is displayed with the correct sign based on tipe_transaksi field
				// For 'masuk' transactions, the amount should be positive
				// For 'keluar' transactions, the amount should be negative
				const jumlah =
					item.tipe_transaksi === "masuk"
						? Math.abs(Number(item.jumlah))
						: -Math.abs(Number(item.jumlah));

				return {
					id: item.id,
					anggota_id: item.anggota_id,
					tipe_transaksi: item.tipe_transaksi,
					source_type: item.source_type,
					deskripsi: item.deskripsi,
					jumlah: jumlah,
					sebelum: item.sebelum,
					sesudah: item.sesudah,
					pembiayaan_id: item.pembiayaan_id,
					tabungan_id: item.tabungan_id,
					created_at: item.created_at,
					updated_at: item.updated_at,
					anggota: item.anggota_nama
						? {
								nama: item.anggota_nama,
								nomor_rekening:
									item.anggota_nomor_rekening,
						  }
						: null,
					tabungan: item.tabungan_id
						? {
								saldo: item.tabungan_saldo,
								jenis_tabungan_id:
									item.tabungan_jenis_id,
								jenis_tabungan:
									item.tabungan_jenis_nama
										? {
												nama: item.tabungan_jenis_nama,
												kode: item.tabungan_jenis_kode,
										  }
										: null,
						  }
						: null,
					pinjaman: item.pembiayaan_jumlah
						? {
								// Map pembiayaan to pinjaman for frontend compatibility
								id: item.pembiayaan_id,
								jumlah: item.pembiayaan_jumlah,
								sisa_pembayaran:
									item.pembiayaan_sisa,
								jenis_pinjaman:
									item.pembiayaan_jenis,
						  }
						: null,
				};
			}) || [];

		console.log(
			`Successfully fetched ${transformedData.length} transactions`
		);

		return NextResponse.json(transformedData);
	} catch (error) {
		console.error("Server error:", error);
		return NextResponse.json(
			{ error: "An unexpected error occurred" },
			{ status: 500 }
		);
	}
}

export async function POST(request: Request) {
	try {
		const body = await request.json();
		console.log("Creating new transaction with data:", body);

		// Validate required fields
		const requiredFields = [
			"anggota_id",
			"tipe_transaksi",
			"source_type",
			"jumlah",
		];
		for (const field of requiredFields) {
			if (!body[field]) {
				return NextResponse.json(
					{ error: `Field '${field}' is required` },
					{ status: 400 }
				);
			}
		}

		// For tabungan transactions, we need a jenis_tabungan_id
		if (body.source_type === "tabungan" && !body.jenis_tabungan_id) {
			return NextResponse.json(
				{
					error: "Jenis tabungan harus dipilih untuk setoran atau penarikan",
				},
				{ status: 400 }
			);
		}

		// Use the RPC function to add the transaction
		const { data, error } = await supabase.rpc("add_transaction", {
			p_anggota_id: body.anggota_id,
			p_tipe_transaksi: body.tipe_transaksi,
			p_source_type: body.source_type,
			p_jumlah: body.jumlah,
			p_deskripsi: body.deskripsi || null,
			p_jenis_tabungan_id: body.jenis_tabungan_id || null,
			// Use pembiayaan_id if provided, otherwise fall back to pinjaman_id for backward compatibility
			p_pembiayaan_id:
				body.pembiayaan_id || body.pinjaman_id || null,
		});

		if (error) {
			console.error("Error creating transaction:", error);
			return NextResponse.json(
				{
					error: `Failed to create transaction: ${error.message}`,
				},
				{ status: 500 }
			);
		}

		// Check if the transaction was successful
		if (!data.success) {
			return NextResponse.json(
				{ error: data.error },
				{ status: 400 }
			);
		}

		return NextResponse.json({
			success: true,
			message: "Transaction created successfully",
			data: {
				id: data.transaction_id,
			},
		});
	} catch (error) {
		console.error("Server error:", error);
		return NextResponse.json(
			{ error: "An unexpected error occurred" },
			{ status: 500 }
		);
	}
}

export async function DELETE(request: Request) {
	try {
		console.log("=== DELETE REQUEST RECEIVED ===");
		const { searchParams } = new URL(request.url);
		const transactionId = searchParams.get("id");
		console.log("Extracted transaction ID:", transactionId);

		if (!transactionId) {
			console.log("No transaction ID provided");
			return NextResponse.json(
				{ error: "Transaction ID is required" },
				{ status: 400 }
			);
		}

		// Check if admin client is available
		if (!supabaseAdmin) {
			console.log(
				"Admin client not available, using regular client"
			);
		} else {
			console.log("Using admin client for delete operation");
		}

		const clientToUse = supabaseAdmin || supabase;

		console.log("Deleting transaction with ID:", transactionId);

		// First, check if the transaction exists
		console.log("Checking if transaction exists...");
		const { data: existingTransaction, error: fetchError } =
			await clientToUse
				.from("transaksi")
				.select(
					"id, anggota_id, tipe_transaksi, jumlah, source_type, tabungan_id, pembiayaan_id"
				)
				.eq("id", transactionId)
				.single();

		console.log("Fetch result:", { existingTransaction, fetchError });

		if (fetchError) {
			console.error("Error fetching transaction:", fetchError);
			return NextResponse.json(
				{
					error: `Transaction not found: ${fetchError.message}`,
				},
				{ status: 404 }
			);
		}

		if (!existingTransaction) {
			console.log("Transaction not found in database");
			return NextResponse.json(
				{ error: "Transaction not found" },
				{ status: 404 }
			);
		}

		console.log("Transaction found, proceeding with delete...");

		// Attempt direct delete
		console.log("Attempting to delete transaction from database...");
		const { error: deleteError, count } = await clientToUse
			.from("transaksi")
			.delete()
			.eq("id", transactionId);

		console.log("Delete operation result:", { deleteError, count });

		if (deleteError) {
			console.error("Error deleting transaction:", deleteError);
			console.error("Error details:", {
				message: deleteError.message,
				details: deleteError.details,
				hint: deleteError.hint,
				code: deleteError.code,
			});
			return NextResponse.json(
				{
					error: `Failed to delete transaction: ${deleteError.message}`,
					details: deleteError.details,
					hint: deleteError.hint,
					code: deleteError.code,
				},
				{ status: 500 }
			);
		}

		console.log("Transaction deleted successfully:", transactionId);

		return NextResponse.json({
			success: true,
			message: "Transaction deleted successfully",
		});
	} catch (error) {
		console.error("Server error:", error);
		return NextResponse.json(
			{ error: "An unexpected error occurred" },
			{ status: 500 }
		);
	}
}
