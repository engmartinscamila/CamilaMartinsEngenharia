import React from 'react';
import {Modal,Pressable,ScrollView,Text,View} from 'react-native';
import {Button} from '@/components/ui';
import {useThemeStyles} from '@/providers/theme-provider';
import {spacing,ThemeColors,typography} from '@/theme/tokens';

export function AdminDetailPanel({visible,title,onClose,children}:{visible:boolean;title:string;onClose:()=>void;children:React.ReactNode}){
 const styles=useThemeStyles(styleDefinitions);
 if(!visible)return null;
 return <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
  <View style={styles.overlay}>
   <Pressable accessibilityRole="button" accessibilityLabel={`Fechar ${title.toLowerCase()}`} onPress={onClose} style={styles.backdrop} />
   <View style={styles.panel} accessibilityViewIsModal>
    <View style={styles.header}><Text accessibilityRole="header" style={styles.title}>{title}</Text><Button title="Fechar painel" onPress={onClose} variant="ghost" /></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">{children}</ScrollView>
   </View>
  </View>
 </Modal>;
}
const styleDefinitions=(colors:ThemeColors)=>({
 overlay:{flex:1,alignItems:'flex-end' as const,backgroundColor:'rgba(0,0,0,.6)'},
 backdrop:{position:'absolute' as const,top:0,left:0,right:0,bottom:0},
 panel:{height:'100%' as const,width:'100%' as const,maxWidth:640,backgroundColor:colors.background,borderLeftWidth:1,borderLeftColor:colors.line},
 header:{flexDirection:'row' as const,flexWrap:'wrap' as const,alignItems:'center' as const,gap:spacing.sm,padding:spacing.md,borderBottomWidth:1,borderBottomColor:colors.line},
 title:{flexGrow:1,flexBasis:240,color:colors.ink,fontFamily:typography.family,fontSize:20,fontWeight:'700' as const},
 content:{padding:spacing.md,gap:spacing.md},
});
