"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import { Loader2 } from "lucide-react"
import { UserTransactions } from "./user-transactions"

interface SavingsDetailsProps {
  userId: string
}

interface SavingsAccount {
  id: string
  anggota_id: string
  anggota_nama: string
  jenis_tabungan_id: string
  jenis_tabungan_kode: string
  jenis_tabungan_nama: string
  jenis_tabungan_deskripsi: string
  minimum_setoran: number
  is_reguler: boolean
  periode_setoran: string
  saldo: number
  tanggal_buka: string
  tanggal_jatuh_tempo: string | null
  status: string
  tanggal_setoran_reguler: number | null
  is_default: boolean
  target_amount: number | null
  progress_percentage: number | null
  last_transaction_date: string | null
  display_order: number
}

export function SavingsDetails({ userId }: SavingsDetailsProps) {
  const [savingsAccounts, setSavingsAccounts] = useState<SavingsAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [transactionsOpen, setTransactionsOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<SavingsAccount | null>(null)

  // Format currency function
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  // Format date function
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    try {
      return format(new Date(dateString), 'dd MMMM yyyy', { locale: id })
    } catch (error) {
      return dateString
    }
  }



  // Fetch savings accounts data
  const fetchSavingsAccounts = async () => {
    setIsLoading(true)
    try {
      // Try to fetch from the view first
      const { data, error } = await supabase
        .from('tabungan_display_view')
        .select('*')
        .eq('anggota_id', userId)
        .order('display_order', { ascending: true })
      
      if (error) {
        // If there's an error with the view, try the fallback query
        console.log('Falling back to direct query')
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('tabungan')
          .select(`
            id,
            anggota_id,
            jenis_tabungan_id,
            saldo,
            created_at,
            status,
            anggota!inner(nama),
            jenis_tabungan!inner(kode, nama, deskripsi)
          `)
          .eq('anggota_id', userId)
        
        if (fallbackError) throw fallbackError
        
        // Transform the data to match the expected format
        const transformedData = (fallbackData || []).map(item => {
          // Safely access nested properties
          const anggotaData = item.anggota as Record<string, any>;
          const jenisTabunganData = item.jenis_tabungan as Record<string, any>;
          
          return {
            id: item.id,
            anggota_id: item.anggota_id,
            anggota_nama: anggotaData?.nama || '',
            jenis_tabungan_id: item.jenis_tabungan_id,
            jenis_tabungan_kode: jenisTabunganData?.kode || '',
            jenis_tabungan_nama: jenisTabunganData?.nama || '',
            jenis_tabungan_deskripsi: jenisTabunganData?.deskripsi || '',
            minimum_setoran: 0, // Default value
            is_reguler: false, // Default value
            periode_setoran: 'bulanan', // Default value
            saldo: item.saldo,
            tanggal_buka: item.created_at,
            tanggal_jatuh_tempo: null,
            status: item.status,
            tanggal_setoran_reguler: null,
            is_default: true, // Default value
            target_amount: null,
            progress_percentage: null,
            last_transaction_date: null,
            display_order: 1 // Default value
          };
        });
        
        setSavingsAccounts(transformedData)
        return
      }
      
      setSavingsAccounts(data || [])
    } catch (error) {
      console.error('Error fetching savings accounts:', error)
      setError('Gagal memuat data tabungan')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSavingsAccounts()
  }, [userId])

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <p className="text-destructive mb-4">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Coba Lagi
        </Button>
      </div>
    )
  }

  if (savingsAccounts.length === 0) {
    return (
      <div className="flex flex-col items-center py-8 text-center">
        <p className="text-muted-foreground mb-4">Anggota ini belum memiliki tabungan</p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-y-auto px-6 py-4" style={{ maxHeight: 'calc(80vh - 150px)' }}>
        <div className="space-y-6">
        {savingsAccounts.map((account) => (
          <Card key={account.id} className={account.is_default ? "border-primary" : ""}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{account.jenis_tabungan_nama}</CardTitle>
                  <CardDescription>ID: {account.id.substring(0, 8)}</CardDescription>
                </div>
                <Badge variant={account.status === 'aktif' ? 'default' : 'destructive'} className={account.is_default ? "bg-primary" : ""}>
                  {account.is_default ? 'Utama' : account.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pb-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-sm font-medium">Saldo</p>
                  <p className="text-2xl font-bold">{formatCurrency(account.saldo)}</p>
                </div>
                {account.target_amount && (
                  <div>
                    <p className="text-sm font-medium">Target</p>
                    <p className="text-lg">{formatCurrency(account.target_amount)}</p>
                    <div className="w-full h-2 bg-muted rounded-full mt-1">
                      <div 
                        className="h-2 bg-primary rounded-full" 
                        style={{ width: `${account.progress_percentage || 0}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Progress: {account.progress_percentage || 0}%
                    </p>
                  </div>
                )}
              </div>
              
              <div className="mt-3 space-y-1">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Jenis Tabungan</span>
                  <span className="text-sm font-medium">{account.jenis_tabungan_kode} - {account.jenis_tabungan_nama}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Deskripsi</span>
                  <span className="text-sm font-medium text-right max-w-[180px] truncate" title={account.jenis_tabungan_deskripsi}>{account.jenis_tabungan_deskripsi}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Tanggal Buka</span>
                  <span className="text-sm font-medium">{formatDate(account.tanggal_buka)}</span>
                </div>
                {account.tanggal_jatuh_tempo && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Tanggal Jatuh Tempo</span>
                    <span className="text-sm font-medium">{formatDate(account.tanggal_jatuh_tempo)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Setoran Minimum</span>
                  <span className="text-sm font-medium">{formatCurrency(account.minimum_setoran)}</span>
                </div>
                {account.is_reguler && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Periode Setoran</span>
                    <span className="text-sm font-medium capitalize">{account.periode_setoran}</span>
                  </div>
                )}

                {account.last_transaction_date && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Transaksi Terakhir</span>
                    <span className="text-sm font-medium">{formatDate(account.last_transaction_date)}</span>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="pt-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => {
                  setSelectedAccount(account);
                  setTransactionsOpen(true);
                }}
              >
                Lihat Riwayat Transaksi
              </Button>
            </CardFooter>
          </Card>
        ))}
        </div>
      </div>


      {/* Transaction History Dialog */}
      {selectedAccount && (
        <UserTransactions 
          user={{
            id: userId,
            nama: selectedAccount.anggota_nama
          }}
          open={transactionsOpen}
          onOpenChange={setTransactionsOpen}
        />
      )}
      



    </>
  )
}
