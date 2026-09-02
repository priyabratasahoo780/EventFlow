import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, FlatList, TextInput, Alert } from 'react-native';
import * as Contacts from 'expo-contacts';
import { User, Search, X, Trash2 } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { LinkedContact } from '../models/Event';

interface Props {
  value?: LinkedContact;
  onSelectContact: (contact?: LinkedContact) => void;
}

export default function ContactSelector({ value, onSelectContact }: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [contactList, setContactList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const openContactPicker = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Contacts permission is required to select a contact.');
        return;
      }

      setModalVisible(true);
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
      });

      if (data.length > 0) {
        setContactList(data);
      }
    } catch (e) {
      console.warn('Contacts error:', e);
    }
  };

  const handleSelect = (item: any) => {
    const phone = item.phoneNumbers && item.phoneNumbers.length > 0 ? item.phoneNumbers[0].number : '';
    const email = item.emails && item.emails.length > 0 ? item.emails[0].email : '';
    onSelectContact({
      name: item.name || 'Unknown Contact',
      phone,
      email
    });
    setModalVisible(false);
  };

  const filteredContacts = contactList.filter(c => 
    c.name && c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <Text style={styles.label}>LINKED CONTACT</Text>

      {value?.name ? (
        <View style={styles.selectedBadge}>
          <User color="#182235" size={18} />
          <View style={styles.selectedInfo}>
            <Text style={styles.selectedName}>{value.name}</Text>
            {value.phone ? <Text style={styles.selectedPhone}>{value.phone}</Text> : null}
          </View>
          <Pressable onPress={() => onSelectContact(undefined)}>
            <Trash2 color={Colors.light.danger} size={18} />
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.selectBtn} onPress={openContactPicker}>
          <User color="#182235" size={18} />
          <Text style={styles.selectBtnText}>LINK A CONTACT</Text>
        </Pressable>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>SELECT CONTACT</Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <X color="#182235" size={24} />
              </Pressable>
            </View>

            <View style={styles.searchBar}>
              <Search color="#182235" size={20} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search contacts..."
                placeholderTextColor="#666"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <FlatList
              data={filteredContacts}
              keyExtractor={(item, index) => (item.id ? `${item.id}-${index}` : `contact-${index}`)}
              renderItem={({ item }) => (
                <Pressable style={styles.contactItem} onPress={() => handleSelect(item)}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item.name?.charAt(0).toUpperCase() || 'C'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactName}>{item.name}</Text>
                    {item.phoneNumbers && item.phoneNumbers.length > 0 ? (
                      <Text style={styles.contactPhone}>{item.phoneNumbers[0].number}</Text>
                    ) : null}
                  </View>
                </Pressable>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  label: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    color: '#667085',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9EDF3',
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: '#182235',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  selectBtnText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 13,
    color: '#182235',
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F5F7FA',
    borderWidth: 1,
    borderColor: '#E9EDF3',
    borderRadius: 16,
    padding: 16,
  },
  selectedInfo: {
    flex: 1,
  },
  selectedName: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    color: '#182235',
  },
  selectedPhone: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: '#667085',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(24,34,53,0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: '85%',
    shadowColor: '#182235',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 20,
    color: '#182235',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E9EDF3',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#182235',
    height: 24,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF0E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Poppins_800ExtraBold',
    fontSize: 18,
    color: '#FF7A00',
  },
  contactName: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 15,
    color: '#182235',
  },
  contactPhone: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: '#667085',
  },
  separator: {
    height: 1,
    backgroundColor: '#E9EDF3',
  }
});
