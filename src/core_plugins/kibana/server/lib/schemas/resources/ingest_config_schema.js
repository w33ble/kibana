import Joi from 'joi';
import indexPatternSchema from './index_pattern_schema';

export default Joi.object({
  index_pattern: indexPatternSchema.required()
});
