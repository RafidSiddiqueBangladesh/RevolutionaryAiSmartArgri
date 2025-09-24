import api from './api';

export const adminService = {
  getFarmers: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', params.page);
    if (params.limit) query.set('limit', params.limit);
    if (params.name) query.set('name', params.name);
    if (params.mobile) query.set('mobile', params.mobile);
    if (params.districtId) query.set('districtId', params.districtId);
    if (params.district) query.set('district', params.district);
    if (params.crop) query.set('crop', params.crop);

    const url = `/admin/farmers${query.toString() ? `?${query.toString()}` : ''}`;
    const { data } = await api.get(url);
    return data;
  }
};

export default adminService;


