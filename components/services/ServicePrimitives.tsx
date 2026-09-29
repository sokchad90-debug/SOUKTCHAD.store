import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { scale } from '@/constants/responsive';

export const PURPLE = '#4C1CEA';
export type Label = { en: string; fr: string; ar: string };
export const localize = (language: string, value: Label) => value[(language === 'fr' || language === 'ar') ? language : 'en'];
export const money = (value: number) => `${value.toLocaleString('fr-FR')} FCFA`;

export function ServiceHeader({ title, search, query, onQuery, isAr, light = false }: { title: string; search?: string; query?: string; onQuery?: (v: string) => void; isAr: boolean; light?: boolean }) {
  const router = useRouter(); const fg = light ? '#111827' : '#FFFFFF';
  return <View style={[styles.header, { backgroundColor: light ? '#FFFFFF' : PURPLE }]}>
    <View style={[styles.titleRow, isAr && styles.rtl]}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.iconButton}><MaterialIcons name={isAr ? 'chevron-right' : 'chevron-left'} size={30} color={fg} /></Pressable><Text style={[styles.title, { color: fg }]}>{title}</Text><View style={styles.iconButton} /></View>
    {search && onQuery ? <View style={[styles.search, isAr && styles.rtl, light && styles.lightSearch]}><MaterialIcons name="search" size={21} color="#64748B" /><TextInput value={query} onChangeText={onQuery} placeholder={search} placeholderTextColor="#64748B" returnKeyType="search" accessibilityLabel={search} style={[styles.input, { textAlign: isAr ? 'right' : 'left' }]} />{!!query && <Pressable onPress={() => onQuery('')} accessibilityRole="button" accessibilityLabel="Clear" style={styles.iconButton}><MaterialIcons name="close" size={19} color="#64748B" /></Pressable>}</View> : null}
  </View>;
}
export function Chips({ values, active, onChange, isAr, colors }: { values: { id: string; label: string }[]; active: string; onChange: (id: string) => void; isAr: boolean; colors: any }) { return <View style={[styles.chips, isAr && styles.rtl]}>{values.map(v => <Pressable key={v.id} accessibilityRole="button" accessibilityState={{ selected: active === v.id }} onPress={() => onChange(v.id)} style={[styles.chip, { backgroundColor: active === v.id ? PURPLE : colors.surface, borderColor: active === v.id ? PURPLE : colors.border }]}><Text style={[styles.chipText, { color: active === v.id ? '#FFF' : colors.textSecondary }]}>{v.label}</Text></Pressable>)}</View>; }
export function Rating({ rating, reviews, color = '#64748B' }: { rating: number; reviews: number; color?: string }) { return <View style={styles.rating}><MaterialIcons name="star" size={16} color="#F59E0B" /><Text style={[styles.meta, { color }]}>{rating} ({reviews})</Text></View>; }
const styles = StyleSheet.create({ header:{paddingHorizontal:scale(12),paddingBottom:scale(12)},titleRow:{minHeight:scale(52),flexDirection:'row',alignItems:'center'},rtl:{flexDirection:'row-reverse'},iconButton:{width:scale(48),height:scale(48),alignItems:'center',justifyContent:'center'},title:{flex:1,fontFamily:'Cairo-Bold',fontSize:scale(18),textAlign:'center'},search:{height:scale(48),borderRadius:scale(24),backgroundColor:'#FFF',flexDirection:'row',alignItems:'center',paddingStart:scale(15),gap:scale(8)},lightSearch:{backgroundColor:'#F1F0FB',borderWidth:1,borderColor:'#E2E8F0'},input:{flex:1,height:'100%',color:'#111827',fontFamily:'Cairo-Regular',fontSize:scale(14)},chips:{flexDirection:'row',flexWrap:'wrap',gap:scale(8),paddingHorizontal:scale(14),paddingVertical:scale(10)},chip:{minHeight:scale(48),paddingHorizontal:scale(16),borderRadius:scale(24),borderWidth:1,justifyContent:'center'},chipText:{fontFamily:'Cairo-SemiBold',fontSize:scale(12)},rating:{flexDirection:'row',alignItems:'center',gap:4},meta:{fontFamily:'Cairo-Regular',fontSize:scale(12)} });
