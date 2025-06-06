"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { Loader2 } from "lucide-react"
import { format } from "date-fns"
// Using centralized supabase client from @/lib/supabase

interface AddSavingsAccountProps {
  userId: string
  userName: string
  onSuccess: () => void
}

interface SavingsType {
  id: string
  kode: string
  nama: string
  minimum_setoran: number
  is_reguler: boolean
  periode_setoran: string | null
  jangka_waktu: number | null
  is_active: boolean
}

export function AddSavingsAccount({ userId, userName, onSuccess }: AddSavingsAccountProps) {
  const { toast } = useToast()
  const [savingsTypes, setSavingsTypes] = useState<SavingsType[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Form state
  const [selectedTypeId, setSelectedTypeId] = useState<string>("")
  const [isDefault, setIsDefault] = useState(false)
  const [selectedType, setSelectedType] = useState<SavingsType | null>(null)
  
  // Fetch available savings types (only those the member doesn't already have)
  useEffect(() => {
    async function fetchSavingsTypes() {
      setIsLoading(true)
      try {
        // Try to use the RPC function first
        const { data: memberSavingsTypes, error: rpcError } = await supabase
          .rpc('get_member_savings_types', {
            anggota_id_param: userId
          })
        
        if (rpcError) throw rpcError
        
        // Get all active savings types
        const { data: allTypes, error: typesError } = await supabase
          .rpc('get_jenis_tabungan')
        
        if (typesError) throw typesError
        
        // Filter out the savings types the member already has
        const existingTypeIds = (memberSavingsTypes || [])
          .filter((type: any) => type.has_account)
          .map((type: any) => type.id)
        
        const availableTypes = (allTypes || []).filter((type: any) => !existingTypeIds.includes(type.id))
        
        setSavingsTypes(availableTypes)
      } catch (error) {
        console.error('Error fetching savings types with RPC:', error)
        
        // Fallback to direct queries if RPC fails
        try {
          // First, get the member's existing savings accounts
          const { data: memberAccounts, error: memberError } = await supabase
            .from('tabungan')
            .select('jenis_tabungan_id')
            .eq('anggota_id', userId)
            .eq('status', 'aktif')
          
          if (memberError) throw memberError
          
          // Extract the IDs of savings types the member already has
          const existingTypeIds = (memberAccounts || []).map(account => account.jenis_tabungan_id)
          
          // Get all active savings types
          const { data, error } = await supabase
            .from('jenis_tabungan')
            .select('*')
            .eq('is_active', true)
            .order('kode', { ascending: true })
          
          if (error) throw error
          
          // Filter out the savings types the member already has
          const availableTypes = (data || []).filter(type => !existingTypeIds.includes(type.id))
          
          setSavingsTypes(availableTypes)
        } catch (fallbackError) {
          console.error('Fallback query also failed:', fallbackError)
          toast({
            title: "Error",
            description: "Gagal memuat data jenis tabungan",
            variant: "destructive"
          })
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchSavingsTypes()
  }, [toast, userId])

  // Update selected type when type ID changes
  useEffect(() => {
    if (selectedTypeId) {
      const type = savingsTypes.find(t => t.id === selectedTypeId)
      setSelectedType(type || null)
    } else {
      setSelectedType(null)
    }
  }, [selectedTypeId, savingsTypes])

  // We no longer need to generate account numbers as the server will do it
  // based on the savings type code

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedTypeId) {
      toast({
        title: "Error",
        description: "Silakan pilih jenis tabungan",
        variant: "destructive"
      })
      return
    }
    
    setIsSubmitting(true)
    
    try {
      // Use the updated add_tabungan_baru function that generates account numbers automatically
      console.log('Attempting to insert account using bypass RLS function');
      
      // Call the updated add_tabungan_baru function without providing a nomor_rekening
      const { data, error } = await supabase.rpc('add_tabungan_baru', {
        p_anggota_id: userId,
        p_jenis_tabungan_id: selectedTypeId,
        p_saldo: 0
      });
      
      console.log('Insert response:', { data, error });
      
      if (error) {
        console.error('Detailed error:', JSON.stringify(error));
        throw error;
      }
      
      toast({
        title: "Berhasil",
        description: `Tabungan baru berhasil ditambahkan untuk ${userName}`,
        variant: "default"
      })
      
      // Call success callback
      onSuccess()
    } catch (error: any) {
      console.error('Error adding savings account:', error)
      
      // Periksa apakah error adalah duplikasi jenis tabungan
      if (error?.message && error.message.includes('Anggota sudah memiliki jenis tabungan ini')) {
        toast({
          title: "⚠️ Duplikasi Tabungan",
          description: `Anggota sudah memiliki jenis tabungan ini. Tidak dapat menambahkan jenis tabungan yang sama.`,
          variant: "destructive"
        })
      } else {
        toast({
          title: "Error",
          description: `Gagal menambahkan tabungan baru: ${error?.message || JSON.stringify(error)}`,
          variant: "destructive"
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="jenis_tabungan">Jenis Tabungan</Label>
          {savingsTypes.length === 0 ? (
            <div className="p-4 border rounded-md bg-muted/50">
              <p className="text-sm text-muted-foreground text-center">
                Anggota ini sudah memiliki semua jenis tabungan yang tersedia.
              </p>
            </div>
          ) : (
            <Select
              value={selectedTypeId}
              onValueChange={setSelectedTypeId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih jenis tabungan" />
              </SelectTrigger>
              <SelectContent>
                {savingsTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.kode} - {type.nama} (Min. {formatCurrency(type.minimum_setoran)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>





        <div className="flex items-center space-x-2">
          <Switch
            id="is_default"
            checked={isDefault}
            onCheckedChange={setIsDefault}
          />
          <Label htmlFor="is_default">Jadikan Tabungan Utama</Label>
        </div>
      </div>

      <div className="flex justify-end space-x-2">
        <Button 
          type="submit" 
          disabled={isSubmitting || savingsTypes.length === 0}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Menyimpan...
            </>
          ) : (
            'Tambah Tabungan'
          )}
        </Button>
      </div>
    </form>
  )
}
