import React from 'react';
import { SafeAreaView, StyleSheet, View, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Text, TextInput, Button } from '../components/Themed';
import { useAssetQuery, useUpdateAsset } from '../api/assets';
import { AssetStatus } from '../types/asset';

const schema = z.object({
  assetType: z.string().min(1),
  status: z.custom<AssetStatus>(),
  wing: z.string().min(1).optional(),
  roomName: z.string().optional(),
  notes: z.string().optional()
});

type FormValues = z.infer<typeof schema>;

export default function EditAssetScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { assetId } = route.params as { assetId: string };
  const { data: asset } = useAssetQuery(assetId);
  const updateMutation = useUpdateAsset(assetId);

  const { control, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      assetType: asset?.assetType || '',
      status: (asset?.status as AssetStatus) || 'ACTIVE',
      wing: asset?.wing || '',
      roomName: asset?.roomName || '',
      notes: asset?.notes || ''
    }
  });

  async function onSubmit(values: FormValues) {
    try {
      await updateMutation.mutateAsync(values);
      Alert.alert('Updated', 'Asset updated successfully');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Failed to update asset');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ padding: 16, gap: 12 }}>
        <Text>Asset Type</Text>
        <Controller name="assetType" control={control} render={({ field: { onChange, value } }) => (
          <TextInput value={value} onChangeText={onChange} placeholder="Asset Type" />
        )} />

        <Text>Status</Text>
        <Controller name="status" control={control} render={({ field: { onChange, value } }) => (
          <TextInput value={value} onChangeText={onChange} placeholder="Status (ACTIVE/INACTIVE/MAINTENANCE/DECOMMISSIONED)" />
        )} />

        <Text>Wing</Text>
        <Controller name="wing" control={control} render={({ field: { onChange, value } }) => (
          <TextInput value={value} onChangeText={onChange} placeholder="Wing" />
        )} />

        <Text>Room Name</Text>
        <Controller name="roomName" control={control} render={({ field: { onChange, value } }) => (
          <TextInput value={value} onChangeText={onChange} placeholder="Room Name" />
        )} />

        <Text>Notes</Text>
        <Controller name="notes" control={control} render={({ field: { onChange, value } }) => (
          <TextInput value={value} onChangeText={onChange} placeholder="Notes" />
        )} />

        <Button title="Save" onPress={handleSubmit(onSubmit)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 } });
