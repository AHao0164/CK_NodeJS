import org.apache.hadoop.conf.Configuration;
import org.apache.hadoop.fs.Path;
import org.apache.hadoop.io.IntWritable;
import org.apache.hadoop.io.Text;
import org.apache.hadoop.mapreduce.Job;
import org.apache.hadoop.mapreduce.lib.input.FileInputFormat;
import org.apache.hadoop.mapreduce.lib.output.FileOutputFormat;
import org.apache.hadoop.mapreduce.Mapper;
import org.apache.hadoop.mapreduce.Reducer;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

public class FirstPass {

    public static class FirstPassMapper extends Mapper<Object, Text, Text, IntWritable> {
        private final static IntWritable one = new IntWritable(1);
        private Text basketKey = new Text();
        private Text item = new Text();

        public void map(Object key, Text value, Context context) throws IOException, InterruptedException {
            // Split each line by commas
            String[] items = value.toString().split(",");

            // Use the first item as the basket identifier (e.g., customer or transaction ID)
            String basketId = items[0].trim();
            basketKey.set(basketId);

            // Loop through the remaining items in the basket (from index 1 onward)
            for (int i = 1; i < items.length; i++) {
                item.set(items[i].trim());
                context.write(item, one);  // Emit each item with a count of 1
            }
        }
    }

    public static class FirstPassReducer extends Reducer<Text, IntWritable, Text, Text> {
        private int s;  // Minimum support threshold
        private int basketNumber = 1;  // Basket number counter

        @Override
        protected void setup(Context context) throws IOException, InterruptedException {
            // Retrieve the support threshold from the configuration
            s = context.getConfiguration().getInt("supportThreshold", 1); // Default value = 1
        }

        public void reduce(Text key, Iterable<IntWritable> values, Context context) throws IOException, InterruptedException {
            int sum = 0;

            // Sum the counts for each item
            for (IntWritable val : values) {
                sum += val.get();
            }

            // Only output items that appear >= s times
            if (sum >= s) {
                context.write(new Text(basketNumber + ","), new Text(key.toString().trim()));
                basketNumber++;
            }
        }
    }

    public static void main(String[] args) throws Exception {
        Configuration conf = new Configuration();

        // Set the support threshold from the command-line argument
        int supportThreshold = Integer.parseInt(args[2]);
        conf.setInt("supportThreshold", supportThreshold);

        Job job = Job.getInstance(conf, "First Pass A-Priori");

        job.setJarByClass(FirstPass.class);
        job.setMapperClass(FirstPassMapper.class);
        job.setReducerClass(FirstPassReducer.class);

        job.setOutputKeyClass(Text.class);
        job.setOutputValueClass(IntWritable.class);

        FileInputFormat.addInputPath(job, new Path(args[0]));
        FileOutputFormat.setOutputPath(job, new Path(args[1]));

        System.exit(job.waitForCompletion(true) ? 0 : 1);
    }
}

