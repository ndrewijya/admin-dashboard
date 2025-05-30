"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { usePermission } from "@/hooks/use-permission"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, Download, MoreHorizontal, Plus, Search, SlidersHorizontal, RefreshCcw, Loader2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getAllPinjaman, Pinjaman } from "@/lib/pinjaman"
import { getAllAnggota, Anggota } from "@/lib/supabase"
import { format, parseISO, differenceInMonths } from "date-fns"
import { downloadCSV, formatDataForExport } from "@/utils/export-data"
import { toast } from "sonner"
import { LoanDetailModal } from "./components/loan-detail-modal"
import { PaymentScheduleModal } from "./components/payment-schedule-modal"
import { RecordPaymentModal } from "./components/record-payment-modal"
import { MarkProblematicModal } from "./components/mark-problematic-modal"
import { CreateLoanModal } from "./components/create-loan-modal"

export default function LoansPage() {
  const { hasPermission: canCreateLoans } = usePermission('approve_loans')
  const [pinjaman, setPinjaman] = useState<Pinjaman[]>([])
  const [filteredPinjaman, setFilteredPinjaman] = useState<Pinjaman[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  
  // Filter states
  const [amountMin, setAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  
  // Modal states
  const [selectedLoan, setSelectedLoan] = useState<Pinjaman | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showProblematicModal, setShowProblematicModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  
  // Members data for the create loan form
  const [members, setMembers] = useState<Anggota[]>([])

  // Format date function
  const formatDate = (dateString: string) => {
    try {
      const date = parseISO(dateString);
      return format(date, 'dd MMM yyyy');
    } catch (error) {
      return dateString;
    }
  };
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return `Rp ${amount.toLocaleString('id-ID')}`;
  };

  // Get badge variant based on status
  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'aktif':
        return {
          variant: 'default',
          className: 'bg-green-500'
        };
      case 'lunas':
        return {
          variant: 'outline',
          className: 'border-green-500 text-green-500'
        };
      case 'diajukan':
        return {
          variant: 'secondary',
          className: ''
        };
      case 'disetujui':
        return {
          variant: 'default',
          className: 'bg-blue-500'
        };
      case 'ditolak':
        return {
          variant: 'destructive',
          className: ''
        };
      default:
        return {
          variant: 'default',
          className: ''
        };
    }
  };

  // Fetch pinjaman data from Supabase
  const fetchPinjaman = async () => {
    setIsLoading(true)
    try {
      console.log('Fetching pinjaman data...')
      const data = await getAllPinjaman()
      console.log('Pinjaman data received:', data)
      setPinjaman(data)
      setFilteredPinjaman(data)
      if (data.length === 0) {
        console.log('No pinjaman data returned from API')
      }
    } catch (error) {
      console.error('Error fetching loans:', error)
      toast.error('Gagal memuat data pinjaman')
    } finally {
      setIsLoading(false)
    }
  }
  
  // Apply all filters
  const applyFilters = () => {
    if (!pinjaman.length) return
    
    let filtered = [...pinjaman]
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(loan => 
        (loan.id && loan.id.toLowerCase().includes(query)) ||
        (loan.anggota?.nama && loan.anggota.nama.toLowerCase().includes(query)) ||
        loan.status.toLowerCase().includes(query)
      )
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(loan => 
        loan.status.toLowerCase() === statusFilter.toLowerCase()
      )
    }
    
    // Apply amount range filter
    if (amountMin) {
      const min = parseFloat(amountMin)
      if (!isNaN(min)) {
        filtered = filtered.filter(loan => 
          Number(loan.jumlah) >= min
        )
      }
    }
    
    if (amountMax) {
      const max = parseFloat(amountMax)
      if (!isNaN(max)) {
        filtered = filtered.filter(loan => 
          Number(loan.jumlah) <= max
        )
      }
    }
    
    // Interest rate filter removed as per Syariah requirements
    
    // Apply date range filter
    if (dateStart) {
      const startDate = new Date(dateStart)
      filtered = filtered.filter(loan => {
        const loanDate = new Date(loan.created_at)
        return loanDate >= startDate
      })
    }
    
    if (dateEnd) {
      const endDate = new Date(dateEnd)
      // Set to end of day
      endDate.setHours(23, 59, 59, 999)
      filtered = filtered.filter(loan => {
        const loanDate = new Date(loan.created_at)
        return loanDate <= endDate
      })
    }
    
    setFilteredPinjaman(filtered)
  }
  
  // Reset all filters
  const resetFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setAmountMin('')
    setAmountMax('')
    setDateStart('')
    setDateEnd('')
    setFilteredPinjaman(pinjaman)
  }
  
  // Export pinjaman data to CSV
  const exportPinjamanData = () => {
    if (!filteredPinjaman.length) {
      toast.error('Tidak ada data pinjaman untuk diekspor')
      return
    }
    
    // Create a simple array for export with the data we need
    const exportData = filteredPinjaman.map(loan => ({
      "ID Pinjaman": loan.id,
      "Nama Anggota": loan.anggota?.nama || 'Anggota',
      "Jumlah Pinjaman": formatCurrency(Number(loan.jumlah)),
      "Sisa Pembayaran": formatCurrency(Number(loan.sisa_pembayaran)),
      "Status": loan.status,
      "Tanggal Pengajuan": formatDate(String(loan.created_at)),
      "Jatuh Tempo": formatDate(String(loan.jatuh_tempo))
    }))

    // Download as CSV
    downloadCSV(exportData, `pinjaman-${new Date().toISOString().split('T')[0]}`)
    toast.success('Data pinjaman berhasil diekspor')
  }

  // Load data on component mount
  useEffect(() => {
    fetchPinjaman()
    fetchMembers()
  }, [])
  
  // Fetch members data
  const fetchMembers = async () => {
    try {
      const data = await getAllAnggota()
      setMembers(data.filter(member => member.is_active))
    } catch (error) {
      console.error('Error fetching members:', error)
      toast.error('Gagal memuat data anggota')
    }
  }
  
  // Apply filters when filter values change
  useEffect(() => {
    applyFilters()
  }, [pinjaman, searchQuery, statusFilter, amountMin, amountMax, dateStart, dateEnd])

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Manajemen Pinjaman</h2>
        {canCreateLoans && (
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Pinjaman
          </Button>
        )}
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            type="search" 
            placeholder="Cari pinjaman..." 
            className="w-full pl-8" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="diajukan">Diajukan</SelectItem>
              <SelectItem value="disetujui">Disetujui</SelectItem>
              <SelectItem value="ditolak">Ditolak</SelectItem>
              <SelectItem value="aktif">Aktif</SelectItem>
              <SelectItem value="lunas">Lunas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto"></div>
        <Button variant="outline" size="icon" onClick={fetchPinjaman}>
          <RefreshCcw className="h-4 w-4" />
          <span className="sr-only">Refresh</span>
        </Button>
        <Button variant="outline" size="icon" onClick={exportPinjamanData}>
          <Download className="h-4 w-4" />
          <span className="sr-only">Export</span>
        </Button>
      </div>



      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredPinjaman.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Tidak ada pinjaman yang ditemukan</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID Pinjaman</TableHead>
                <TableHead>Nama Anggota</TableHead>
                <TableHead>Jumlah</TableHead>
                <TableHead>Sisa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tanggal Pengajuan</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPinjaman.map((loan) => (
                <TableRow key={loan.id}>
                  <TableCell className="font-medium">{loan.id.substring(0, 8)}</TableCell>
                  <TableCell>{loan.anggota?.nama || 'Anggota'}</TableCell>
                  <TableCell>{formatCurrency(Number(loan.jumlah))}</TableCell>
                  <TableCell>{formatCurrency(Number(loan.sisa_pembayaran))}</TableCell>
                  <TableCell>
                    <Badge
                      variant={getStatusBadgeVariant(loan.status).variant as any}
                      className={getStatusBadgeVariant(loan.status).className}
                    >
                      {loan.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(loan.created_at.toString())}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Aksi</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => {
                          setSelectedLoan(loan);
                          setShowDetailModal(true);
                        }}>
                          Lihat Detail
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          setSelectedLoan(loan);
                          setShowScheduleModal(true);
                        }}>
                          Jadwal Pembayaran
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => {
                            setSelectedLoan(loan);
                            setShowPaymentModal(true);
                          }}
                          disabled={loan.status === 'lunas'}
                        >
                          Catat Pembayaran
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => {
                            setSelectedLoan(loan);
                            setShowProblematicModal(true);
                          }}
                          disabled={loan.status === 'lunas'}
                        >
                          Tandai Bermasalah
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Menampilkan {filteredPinjaman.length} dari {pinjaman.length} pinjaman
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" disabled>
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Halaman Sebelumnya</span>
          </Button>
          <Button variant="outline" size="icon" disabled>
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Halaman Berikutnya</span>
          </Button>
        </div>
      </div>

      {/* Loan Detail Modal */}
      <LoanDetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        loan={selectedLoan}
        onViewSchedule={() => {
          setShowDetailModal(false);
          setShowScheduleModal(true);
        }}
        onRecordPayment={() => {
          setShowDetailModal(false);
          setShowPaymentModal(true);
        }}
      />

      {/* Payment Schedule Modal */}
      <PaymentScheduleModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        loan={selectedLoan}
      />

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        loan={selectedLoan}
        onPaymentRecorded={() => {
          toast.success("Pembayaran berhasil dicatat");
          fetchPinjaman();
        }}
      />

      {/* Mark Problematic Modal */}
      <MarkProblematicModal
        isOpen={showProblematicModal}
        onClose={() => setShowProblematicModal(false)}
        loan={selectedLoan}
        onMarked={() => {
          toast.success("Pinjaman berhasil ditandai bermasalah");
          fetchPinjaman();
        }}
      />

      {/* Create Loan Modal */}
      <CreateLoanModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onLoanCreated={() => {
          fetchPinjaman();
        }}
        members={members}
      />
    </div>
  )
}
