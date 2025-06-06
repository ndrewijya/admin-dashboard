"use client"

import { useState, useEffect, ReactNode } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Akun = {
  id: string
  nomor_telepon: string
  pin: string | null
  anggota_id: string | null
  created_at: Date | string
  updated_at: Date | string
  is_verified: boolean
  is_active: boolean
  anggota?: {
    nama: string
    nomor_rekening: string
  }
}

type Anggota = {
  id: string
  nama: string
  nomor_rekening: string
}

interface EditAkunFormProps {
  akun: Akun | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onAkunUpdated: () => void
}

// Form schema
const formSchema = z.object({
  nomor_telepon: z.string()
    .min(10, "Nomor telepon minimal 10 digit")
    .max(15, "Nomor telepon maksimal 15 digit")
    .regex(/^\+?[0-9]+$/, "Format nomor telepon tidak valid"),
  pin: z.string()
    .min(6, "PIN minimal 6 digit")
    .max(6, "PIN maksimal 6 digit")
    .regex(/^[0-9]+$/, "PIN harus berupa angka")
    .optional()
    .or(z.literal('')),
  anggota_id: z.string().optional().nullable(),
  is_verified: z.boolean().default(false),
  is_active: z.boolean().default(true),
})

export function EditAkunForm({ akun, open, onOpenChange, onAkunUpdated }: EditAkunFormProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [anggotaList, setAnggotaList] = useState<Anggota[]>([])
  const [isLoadingAnggota, setIsLoadingAnggota] = useState(false)

  // Initialize form
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nomor_telepon: "",
      pin: "",
      anggota_id: null,
      is_verified: false,
      is_active: true,
    },
  })

  // Fetch anggota list
  const fetchAnggotaList = async () => {
    setIsLoadingAnggota(true)
    try {
      const { data, error } = await supabase
        .from('anggota')
        .select('id, nama, nomor_rekening')
        .eq('is_active', true)
        .order('nama', { ascending: true })
      
      if (error) throw error
      
      setAnggotaList(data || [])
    } catch (error) {
      console.error('Error fetching anggota list:', error)
      toast({
        title: "Error",
        description: "Gagal memuat daftar anggota. Silakan coba lagi.",
        variant: "destructive"
      })
    } finally {
      setIsLoadingAnggota(false)
    }
  }

  // Reset form when dialog opens/closes or akun changes
  useEffect(() => {
    if (open) {
      fetchAnggotaList()
      
      if (akun) {
        // Edit mode - populate form with akun data
        form.reset({
          nomor_telepon: akun.nomor_telepon,
          pin: "", // Don't show existing PIN for security reasons
          anggota_id: akun.anggota_id,
          is_verified: akun.is_verified,
          is_active: akun.is_active,
        })
      } else {
        // Create mode - reset form
        form.reset({
          nomor_telepon: "",
          pin: "",
          anggota_id: null,
          is_verified: false,
          is_active: true,
        })
      }
    }
  }, [open, akun, form])

  // Form submission handler
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true)
    try {
      // Check if nomor_telepon already exists (for new accounts)
      if (!akun) {
        const { data: existingAkun, error: checkError } = await supabase
          .from('akun')
          .select('id')
          .eq('nomor_telepon', values.nomor_telepon)
          .maybeSingle()
        
        if (checkError) throw checkError
        
        if (existingAkun) {
          form.setError('nomor_telepon', { 
            type: 'manual', 
            message: 'Nomor telepon sudah terdaftar' 
          })
          setIsSubmitting(false)
          return
        }
      }
      
      // Check if anggota_id is already linked to another account
      if (values.anggota_id && values.anggota_id !== 'none' && values.anggota_id !== akun?.anggota_id) {
        const { data: existingAccount, error: checkError } = await supabase
          .from('akun')
          .select('id')
          .eq('anggota_id', values.anggota_id)
          .maybeSingle()
        
        if (checkError) throw checkError
        
        if (existingAccount) {
          form.setError('anggota_id', { 
            type: 'manual', 
            message: 'Anggota ini sudah terhubung dengan akun lain' 
          })
          setIsSubmitting(false)
          return
        }
      }
      
      // Prepare data for insert/update
      const akunData: any = {
        nomor_telepon: values.nomor_telepon,
        anggota_id: values.anggota_id,
        is_verified: values.is_verified,
        is_active: values.is_active,
      }
      
      // Only include PIN if it's provided (for new accounts or PIN reset)
      if (values.pin && values.pin.trim() !== '') {
        akunData.pin = values.pin
      }
      
      let result
      
      if (akun) {
        // Update existing akun
        result = await supabase
          .from('akun')
          .update(akunData)
          .eq('id', akun.id)
      } else {
        // Create new akun
        result = await supabase
          .from('akun')
          .insert(akunData)
      }
      
      if (result.error) {
        console.error('Supabase error details:', result.error)
        
        // Check for duplicate phone number error
        if (result.error.code === '23505' && result.error.message.includes('akun_nomor_telepon_key')) {
          form.setError('nomor_telepon', { 
            type: 'manual', 
            message: 'Nomor telepon sudah terdaftar' 
          })
          
          toast({
            title: "Nomor Telepon Duplikat",
            description: "Nomor telepon ini sudah digunakan oleh akun lain",
            variant: "destructive",
            duration: 5000
          })
          setIsSubmitting(false)
          return
        }
        
        throw new Error(result.error.message || 'Terjadi kesalahan saat menyimpan akun')
      }
      
      toast({
        title: "Berhasil",
        description: akun 
          ? "Akun berhasil diperbarui" 
          : "Akun baru berhasil dibuat",
      })
      
      onOpenChange(false)
      onAkunUpdated()
    } catch (error: any) {
      console.error('Error saving akun:', error)
      
      // Determine the error message
      let errorMessage = "Terjadi kesalahan yang tidak diketahui";
      
      // Check if it's a PostgreSQL error with a code
      if (error.code) {
        switch (error.code) {
          case '23505':
            // Check for specific unique constraint violations
            if (error.message && error.message.includes('unique_anggota_id')) {
              errorMessage = "Anggota ini sudah terhubung dengan akun lain";
              form.setError('anggota_id', { 
                type: 'manual', 
                message: 'Anggota ini sudah terhubung dengan akun lain' 
              });
            } else if (error.message && error.message.includes('akun_nomor_telepon_key')) {
              errorMessage = "Nomor telepon sudah terdaftar";
              form.setError('nomor_telepon', { 
                type: 'manual', 
                message: 'Nomor telepon sudah terdaftar' 
              });
            } else {
              errorMessage = "Data duplikat terdeteksi";
            }
            break;
          case '23503':
            errorMessage = "Anggota yang dipilih tidak valid";
            break;
          case '23502':
            errorMessage = "Ada kolom yang tidak boleh kosong";
            break;
          default:
            errorMessage = `Error database (${error.code})`;
        }
      } 
      // Check for duplicate phone number in error message
      else if (error.message) {
        if (error.message.includes('duplicate key') && error.message.includes('akun_nomor_telepon_key')) {
          errorMessage = "Nomor telepon sudah digunakan oleh akun lain";
          form.setError('nomor_telepon', { 
            type: 'manual', 
            message: 'Nomor telepon sudah terdaftar' 
          });
        } else if (error.message !== '{}') {
          errorMessage = error.message;
        }
      }
      // If we still don't have a good error message, try to extract it from the error object
      else if (typeof error === 'object') {
        try {
          const errorStr = JSON.stringify(error);
          if (errorStr !== '{}') {
            // Check for duplicate phone number in the stringified error
            if (errorStr.includes('akun_nomor_telepon_key')) {
              errorMessage = "Nomor telepon sudah digunakan oleh akun lain";
              form.setError('nomor_telepon', { 
                type: 'manual', 
                message: 'Nomor telepon sudah terdaftar' 
              });
            } else {
              errorMessage = `Detail error: ${errorStr}`;
            }
          }
        } catch (e) {
          // If JSON stringify fails, just use the default message
        }
      }
      
      toast({
        title: "Error",
        description: `Gagal ${akun ? 'memperbarui' : 'membuat'} akun: ${errorMessage}`,
        variant: "destructive",
        duration: 5000,
        action: errorMessage.includes("Nomor telepon") ? (
          <div className="flex items-center justify-center bg-red-100 dark:bg-red-900 p-2 rounded-md mt-2">
            <span className="text-red-600 dark:text-red-300 text-sm font-medium">
              Gunakan nomor telepon yang berbeda
            </span>
          </div>
        ) : undefined
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{akun ? 'Edit Akun' : 'Tambah Akun Baru'}</DialogTitle>
          <DialogDescription>
            {akun 
              ? 'Perbarui informasi akun pengguna' 
              : 'Isi formulir berikut untuk membuat akun baru'}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <FormField
              control={form.control}
              name="nomor_telepon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nomor Telepon</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="+628123456789" 
                      {...field} 
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    Format: +62 diikuti nomor telepon tanpa spasi
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {!akun && (
              <FormField
                control={form.control}
                name="pin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PIN</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Masukkan 6 digit PIN" 
                        {...field} 
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormDescription>
                      PIN harus terdiri dari 6 digit angka
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <FormField
              control={form.control}
              name="anggota_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Anggota</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                    value={field.value || "none"}
                    disabled={isSubmitting || isLoadingAnggota}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih anggota" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Tidak terkait anggota</SelectItem>
                      {anggotaList.map((anggota) => (
                        <SelectItem key={anggota.id} value={anggota.id}>
                          {anggota.nama} ({anggota.nomor_rekening})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Hubungkan akun dengan anggota koperasi
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="is_verified"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Terverifikasi
                    </FormLabel>
                    <FormDescription>
                      Akun yang terverifikasi dapat mengakses aplikasi
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Aktif
                    </FormLabel>
                    <FormDescription>
                      Akun yang aktif dapat melakukan login
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {akun ? 'Simpan Perubahan' : 'Buat Akun'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
